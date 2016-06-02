'use strict';

const async = require('async');
const storage = require('../../storage');

exports.handler = function (req, res, next) {
  const contentID = req.params.id;
  const prefix = req.query.prefix;
  req.logger.debug('Content deletion request received.', { contentID, prefix });

  const handleError = (err, message) => {
    err.statusCode = err.statusCode || err.status || 500;

    req.logger.reportError(message, err, { payload: { contentID, prefix } });
    return next(err);
  };

  const completeRemoval = (contentIDs) => {
    removeEnvelopes(contentIDs, (err) => {
      if (err) return handleError(err, 'Unable to delete content.');

      res.send(204);

      req.logger.reportSuccess('Content deletion successful.', {
        count: contentIDs.length,
        contentIDs
      });
      next();
    });
  };

  if (!prefix) {
    completeRemoval([contentID]);
  } else {
    const contentIDs = [];
    storage.listEnvelopes(contentID, (err, envelope) => {
      if (err) return handleError(err, 'Unable to list envelopes.');

      contentIDs.push(envelope.contentID);
    }, (err) => {
      if (err) return handleError(err, 'Unable to list envelopes.');

      completeRemoval(contentIDs);
    });
  }
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
