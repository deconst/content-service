'use strict';

const async = require('async');
const storage = require('../../storage');

exports.handler = function (req, res, next) {
  var contentID = req.params.id;
  req.logger.debug('Content deletion request received.', { contentID });

  removeEnvelopes([contentID], function (err) {
    if (err) {
      err.statusCode = err.statusCode || err.status || 500;

      req.logger.reportError('Unable to delete content.', err, { payload: { contentID } });
      return next(err);
    }

    res.send(204);

    req.logger.reportSuccess('Content deletion successful.', { contentID });
    next();
  });
};

const removeEnvelopes = exports.removeEnvelopes = function (contentIDs, callback) {
  if (contentIDs.length === 0) {
    return process.nextTick(callback);
  }

  var kvDelete = (cb) => {
    if (contentIDs.length === 1) {
      storage.deleteEnvelope(contentIDs[0], cb);
    } else {
      storage.bulkDeleteEnvelopes(contentIDs, cb);
    }
  };

  var ftsDelete = (cb) => {
    if (contentIDs.length === 1) {
      storage.unindexEnvelope(contentIDs[0], cb);
    } else {
      storage.bulkUnindexEnvelopes(contentIDs, cb);
    }
  };

  async.parallel([
    kvDelete,
    ftsDelete
  ], callback);
};
