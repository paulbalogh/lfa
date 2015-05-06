var chalk = require('chalk');
var prettyErrors = require('../pretty-errors');
var prompt = require('prompt');
var vfs = require('vinyl-fs');
var pipeErrors = require('../../src/pipe-errors');
var path = require('path');
var when = require('when');
var nodefn = require('when/node');
var _ = require('lodash');
var es = require('event-stream');
var through = require('through2');
var File = require('vinyl');
var fs = require('fs');
var rename = require('gulp-rename');
var Repository = require('git-cli').Repository;

function capitalizeFirstLetters(s) {
  s = s.replace(/-/g, ' ');
  s = s.replace(/^\s+/, '');
  s = s.replace(/\s+$/, '');

  var match;
  while ((match = s.match(/(^| )[a-z]/)) !== null) {
    var idx = match.index;
    if (idx !== 0) {
      idx++;
    }
    s = s.substr(0, idx) + s.substr(idx, 1).toLocaleUpperCase() + s.substr(idx+1);
  }

  return s;
}

module.exports = function newProject(cli) {
  var verbose = cli.flags.v || cli.flags.verbose;

  when.try(function () {
    var schema = [{
      name: 'bookId',
      description: 'Book ID',
      message: 'The book ID can only contain lowercase characters, numbers and dashes',
      pattern: /^[a-z0-9-]+$/,
      default: cli.input[1],
    },{
      name: 'title',
      description: 'Book Title',
      default: capitalizeFirstLetters(cli.input[1]),
    },{
      name: 'language',
      description: 'Book Language',
      message: 'The language must be a 2-letter code (ISO 639-1)',
      pattern: /^[a-z][a-z]$/,
      default: 'en',
    }];

    _.each(schema, function (pr) {
      pr.description = chalk.yellow(pr.description + ':');
    });

    if (cli.input.length < 2) {
      throw new Error('The second parameter to lfa new should be the name of the newly created directory');
    }

    var projPath = path.resolve(cli.input[1]);

    console.log('Creating new project in ' + chalk.yellow(projPath));

    prompt.message = '';
    prompt.delimiter = '';
    prompt.start();
    return nodefn.call(prompt.get.bind(prompt), schema)
      .then(function (result) {
        process.stdout.write(chalk.green('scaffolding project... '));
        
        var skelPath = path.resolve(__dirname, '..', '..', 'skel');
        var packageStream = pipeErrors(through.obj());
        var destinationStream = vfs.dest(projPath);
        var sourceStream = pipeErrors(vfs.src(path.join(skelPath, '**', '*')))
          .pipe(rename(function (path) {
            path.basename = path.basename.replace(/^___/, '.');
          }));

        process.nextTick(function () {
          var packageJson = {
            name: result.bookId,
            version: '1.0.0',
            keywords: ['lfa-book'],
            book: {
              title: result.title,
              language: result.language,
            },
            engines: {
              'lfa' : '~0.7.0'
            }
          };

          var packageFile = new File({
            base: '',
            path: path.join('.lfa', 'package.json'),
            contents: new Buffer(JSON.stringify(packageJson, null, 2)),
          });

          packageStream.write(packageFile);
          packageStream.end();
        });

        es.merge(sourceStream, packageStream)
          .pipe(destinationStream);

        return when.promise(function (resolve, reject) {
          destinationStream.on('error', reject);
          destinationStream.on('end', resolve);
        }).then(function () {
          console.log('done');
          process.stdout.write(chalk.green('creating git repository... '));

        }).then(function () {
          return nodefn.call(Repository.init.bind(Repository), projPath);
        }).then(function (repo) {
          return nodefn.call(repo.add.bind(repo))
            .then(function () { return repo; });
        }).then(function (repo) {
          return nodefn.call(repo.commit.bind(repo), 'Initial commit');
        }).then(function () {
          console.log('done');
        }).catch(function (err) {
          console.log(chalk.red('error'));
          throw err;
        });
      });
  }).catch(prettyErrors(verbose));
};