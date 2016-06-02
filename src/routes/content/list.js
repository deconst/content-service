'use strict';

const storage = require('../../storage');

exports.handler = function (req, res, next) {
  req.logger.debug('Content list requested.');

  const results = [];

  const handleError = (message, err) => {
    err.statusCode = err.status = 500;
    req.logger.reportError(message, err);
    return next(err);
  };

  storage.listEnvelopes(null, (err, each) => {
    if (err) return handleError('Unable to retrieve envelope', err);

    results.push({
      contentID: each.contentID,
      url: `/content/${encodeURIComponent(each.contentID)}`
    });
  }, (err) => {
    if (err) return handleError('Unable to enumerate envelopes', err);

    res.send(200, { total: 0, results });
  });
};
