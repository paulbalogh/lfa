var chokidar = require('chokidar');
var when = require('when');

function FileMonitor() {}

var _eventHandlers = {
  add: function (path) {
    this.callback({ created: [path] });
  },
  change: function (path) {
    this.callback({ changed: [path] });
  },
  unlink: function (path) {
    this.callback({ removed: [path] });
  },
  addDir: function (path) {
    // TODO
  },
  unlinkDir: function (path) {
    // TODO
  },
};

function _processQueue() {
  var self = this;
  var q = self.queue;

  if (q.length === 0) { return; }
  var evt = q.splice(0, 1)[0];
  return when.try(function () {
    //console.log(evt.type, evt.path);
    return _eventHandlers[evt.type].call(self, evt.path);
  }).then(_processQueue.bind(self));
}

FileMonitor.prototype.init = function (root, cb) {
  var self = this;

  self.callback = cb;
  var queue = self.queue = [];

  var opts = {
    ignored: /node_modules|[\/\\]\./,
    persistent: true,
  };
  var watcher = chokidar.watch(root, opts);
  self.watcher = watcher;

  return when.promise(function (resolve, reject) {
    function errorHandler(err) {
      reject(err);
      watcher.removeListener('error', errorHandler);
    }
    watcher.on('error', errorHandler);
    watcher.on('ready', function () { 
      watcher.removeListener('error', errorHandler);
      resolve(watcher);
    });
  }).then(function () {
    function queueEvent(evt) {
      return function (path) {
        queue.push({ type: evt, path: path });
        if (queue.length === 1) {
          _processQueue.call(self);
        }
      };
    }
    watcher.on('add', queueEvent('add'));
    watcher.on('addDir', queueEvent('addDir'));
    watcher.on('change', queueEvent('change'));
    watcher.on('unlink', queueEvent('unlink'));
    watcher.on('unlinkDir', queueEvent('unlinkDir'));
  });
};

FileMonitor.prototype.stop = function () {
  this.watcher.stop();
};

module.exports = function () {
  var fm = new FileMonitor();
  return fm.init.apply(fm, arguments);
};
