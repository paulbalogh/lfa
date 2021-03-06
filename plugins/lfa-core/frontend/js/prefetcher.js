var _ = require('lodash');
var Chapters = require('lfa-book').Chapters || require('./chapters-poly');

function Prefetcher() {
  this.cache = {};
  this.maxCacheLength = 64 * 1024; //64 kB
  this.maxCachedChapters = 10;
  this.cacheLength = 0;
  this.cachedChapters = 0;
  this.chapterPriority = [];
  this.priorityHash = {};
  this.cacheSize = {};
}

Prefetcher.prototype.chapterFinishedCaching = function(key, err, value) {
  if (err) {
    delete this.cache[key];
  } else {
    this.cache[key] = true;
    this.cacheSize[key] = value.length;
    this.cacheLength += value.length;
    this.cachedChapters++;
  }
  this.rebalanceCache();
};

Prefetcher.prototype.reclaimCache = function(tillPriority) {
  var hash = this.priorityHash;
  while (this.cacheLength > this.maxCacheLength || this.cachedChapters > this.maxCachedChapters) {
    var maxPri = -1;
    var maxCache = null;
    _.each(this.cache, function(value, key) {
      var pri = hash[key];
      if (pri > maxPri) {
        maxPri = pri;
        maxCache = key;
      }
    });
    if (maxPri <= tillPriority || !maxCache) { break; }
    this.invalidateCacheForChapter(maxCache);
  }
};

Prefetcher.prototype.invalidateCacheForChapter = function(key) {
  if (this.cache[key]) {
    this.cacheLength -= this.cacheSize[key];
    this.cachedChapters--;
    delete this.cache[key];
    delete this.cacheSize[key];
  }
  Chapters.removeLoadedChapter(key);
};

Prefetcher.prototype.rebalanceCache = function() {
  for (var i = 0, v = this.chapterPriority, n = v.length; i < n; i++) {
    var ch = v[i];
    var priority = this.priorityHash[ch];
    var cacheQ = this.cache[ch];
    if (cacheQ === 2) { return; } //loading
    if (!cacheQ) {
      this.reclaimCache(priority);
      if (this.cacheLength <= this.maxCacheLength && this.cachedChapters <= this.maxCachedChapters) {
        this.cache[ch] = 2;
        Chapters.loadChapter(ch, this.chapterFinishedCaching.bind(this, ch));
      }
      return;
    }
  }
};

Prefetcher.prototype.setChapterPriority = function(priority) {
  this.chapterPriority = priority;
  var h = this.priorityHash = {};
  for (var i = 0, n = priority.length; i < n; i++) {
    h[priority[i]] = i;
  }
  this.rebalanceCache();
};

module.exports = Prefetcher;
