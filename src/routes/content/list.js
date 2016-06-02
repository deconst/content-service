'use strict';

const async = require('async');
const storage = require('../../storage');

exports.handler = function (req, res, next) {
  const options = {
    prefix: req.query.prefix
  };

  req.logger.debug('Content list requested.', options);

  const results = [];

  const handleError = (message, err) => {
    err.statusCode = err.status = 500;
    req.logger.reportError(message, err, { payload: options });
    return next(err);
  };

  async.parallel({
    total: (cb) => storage.countEnvelopes(options, cb),
    results: (cb) => storage.listEnvelopes(options, (each) => {
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
