// Reindex submitted content from its canonical source.

var storage = require('../storage');
var log = require('../logging').getLogger();

exports.state = {
  inProgress: false,
  reindexedEnvelopes: 0,
  totalEnvelopes: 0,
  startedTimestamp: null
};

exports.begin = function (req, res, next) {
  res.send(202);
  next();
};
