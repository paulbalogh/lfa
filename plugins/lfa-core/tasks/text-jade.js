var fastJade = require('./jade-fast-compiler');
var through = require('through2');
var gutil = require('gulp-util');
var path = require('path');
var File = require('vinyl');
var _ = require('lodash');
var when = require('when');
var nodefn = require('when/node');
var fs = require('fs');

var PLUGIN_NAME = 'text-jade';
var boilerplate = [
  'registerChapter({ chapter: "',
  null,
  '", content: function () { return ',
  null,
  '; }});'
];

function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

module.exports = function textJadeTasks(lfa) {
  var config = lfa.config;

  function getMixinPaths() {
    var mixinPaths = _.map(lfa.plugins, function (plugin) {
      return path.join(plugin.path, 'frontend', 'mixins');
    });
    mixinPaths.push(path.join(config.projectPath, 'mixins'));
    return mixinPaths;
  }

  function getFrontMatter(mixinPaths) {
    // Collect mixins from all over the place
    var cachedFrontMatter = lfa.currentCompile.textJadeMixinPathCache;
    if (cachedFrontMatter) { return cachedFrontMatter; }

    return lfa.currentCompile.textJadeMixinPathCache = when.try(function () {
      return when.all(_.map(mixinPaths, function (tp) {
        tp = path.join(tp, 'index.jade');
        return nodefn.call(fs.stat, tp)
          .then(function (stat) {
            return stat.isFile() ? tp : null;
          })
          .catch(function () {
            return null;
          });
      }));

    }).then(function (paths) {
      return _.filter(paths, function (o) { return o !== null; });

    }).then(function (paths) {
      return when.all(_.map(paths, function (filePath) { 
        return fastJade.compileFrontMatter(filePath);
      }));
    });
  }

  lfa.task('text:files:jade', function () {
    var self = this;
    var glob = path.join(config.projectPath, 'text', '**', '*.jade');

    var mixinPaths = getMixinPaths();
    var mixinGlobs = _.map(mixinPaths, function (p) { 
      return path.join(p, '**', '*.jade');
    });
    self.addFileDependencies(mixinGlobs);
    self.addFileDependencies(glob);

    var filterModified = null ;
    if (lfa.previousCompile) {
      // If the mixins don't need recompilation
      if (!self.filterModifiedFiles(mixinGlobs).length) {
        // Just recompile that one specific file
        filterModified = this;
      } else {
        // Mark mixins for recompilation
        lfa.currentCompile.textJadeMixinPathCache = null;
      }
    }

    return lfa.src(glob, { filterModified: filterModified })
      .pipe(through.obj(function (file, enc, cb) {
        if (file.isStream()) {
          return cb(new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
        }

        var tocpath = file.relative.replace(/\.jade$/, '');
        var url = tocpath.replace(new RegExp(escapeRegExp(path.sep), 'g'), '-');

        getFrontMatter(mixinPaths)
          .then(function (front) {
            return fastJade.compile(
              file.contents.toString('utf8'),
              front,
              { filename: file.path });
          })
          .then(function (template) {
            var locals = { meta: {} };
            locals.meta.url = url;
            locals.meta.path = tocpath;
            var text = template(locals);

            boilerplate[1] = url;
            boilerplate[3] = JSON.stringify(text);
            var newFile = new File({
              base: '',
              path: path.join('chapters', url + '.js'),
              contents: new Buffer(boilerplate.join(''), 'utf8'),
            });
            newFile.textMeta = locals.meta;
            cb(null, newFile);
          })
          .catch(function(err) {
            return cb(new gutil.PluginError(PLUGIN_NAME, err));
          });

      }));
  });
};