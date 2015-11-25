// Reindex submitted content from its canonical source.

var storage = require('../storage');
var log = require('../logging').getLogger();

/**
 * @description Callback to fire when reindexing is complete.
 */
exports.completedCallback = function (state) {};

/**
 * @description Trigger an asynchronous reindexing of all content.
 */
exports.begin = function (req, res, next) {
  res.send(202);
  next();
};
