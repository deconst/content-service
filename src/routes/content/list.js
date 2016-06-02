'use strict';

const async = require('async');
const storage = require('../../storage');

exports.handler = function (req, res, next) {
  req.logger.debug('Content list requested.');

  const results = [];

  const handleError = (message, err) => {
    err.statusCode = err.status = 500;
    req.logger.reportError(message, err);
    return next(err);
  };

  async.parallel({
    total: (cb) => storage.countEnvelopes({}, cb),
    results: (cb) => storage.listEnvelopes(null, (err, each) => {
      if (err) return handleError('Unable to retrieve envelope', err);

      results.push({
        contentID: each.contentID,
        url: `/content/${encodeURIComponent(each.contentID)}`
      });
    }, cb)
  }, (err, output) => {
    if (err) return handleError('Unable to list envelopes', err);

    res.send(200, { total: output.total, results });
  });
};
