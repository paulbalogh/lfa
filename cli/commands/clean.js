var LFA = require('../../');
var chalk = require('chalk');
var prettyErrors = require('../pretty-errors');

module.exports = function compile(cli) {
  var projPath = cli.flags.book;
  var verbose = cli.flags.v || cli.flags.verbose;

  process.stdout.write(chalk.green('cleaning up... '));

  return LFA.cleanProject({
    path: projPath,
    pluginProject: cli.flags.plugin,
  }).then(function () {
    console.log('done');
  }).catch(function (err) {
    console.log(chalk.red('error'));
    throw err;
  }).catch(prettyErrors(verbose));
};
