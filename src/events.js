var Events = {};

Events.logError = function (err) {
  this.emit('compile-error', err);
};

Events.logWarning = function (err) {
  if (this.config.currentCompile && this.config.currentCompile.warningsAsErrors) {
    throw err;
  }
  this.emit('compile-warning', err);
};

Events.logNotice = function (err) {
  this.emit('compile-notice', err);
};

module.exports = Events;

