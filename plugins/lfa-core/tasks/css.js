var concat = require('gulp-concat');
var stylusTasks = require('./css-stylus');

module.exports = function cssTasks(lfa) {
  stylusTasks(lfa);

  lfa.task('default:css', ['css:files:*'], function (cssFiles) {
    // TODO: This doesn't go well with concat, but since we only have one CSS source, it's fine
    this.setDependencyMode(cssFiles, 'modify');
    return cssFiles 
      .pipe(lfa.hook('css:filter:*'))
      .pipe(concat({ 
        base: '',
        path: 'main.css',
      }))
      .pipe(lfa.hook('pre-write:*'))
      .pipe(lfa.hook('css:pre-write:*'))
      .pipe(lfa.dst(lfa.currentCompile.buildPath))
      .pipe(lfa.hook('css:post-write:*'))
      .pipe(lfa.hook('post-write:*'));
  });
};