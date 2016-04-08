'use strict';

const async = require('async');
const storage = require('../../storage');

/**
 * @description Store new content into the content service.
 */
exports.handler = function (req, res, next) {
  const contentID = req.params.id;
  const envelope = req.body;

  req.logger.debug('Content storage request received.', { contentID });

  storeEnvelope(contentID, envelope, (err) => {
    if (err) {
      req.logger.reportError('Unable to store content.', err);
      return next(err);
    }

    res.send(204);
    req.logger.reportSuccess('Content storage successful.', { statusCode: 204, contentID });
    next();
  });
};

const storeEnvelope = exports.storeEnvelope = function (contentID, envelope, callback) {
  async.parallel([
    (cb) => storage.storeEnvelope(contentID, envelope, cb),
    (cb) => storage.indexEnvelope(contentID, envelope, cb)
  ], callback);
};
