'use strict';

const async = require('async');
const storage = require('../../storage');
const logger = require('../../logging').getLogger();

exports.handler = function (req, res, next) {
  var contentID = req.params.id;
  logger.debug('Content deletion request received.', {
    action: 'content delete',
    apikeyName: req.apikeyName,
    contentID: contentID
  });

  var reqStart = Date.now();

  var kvDelete = function (cb) {
    storage.deleteContent(contentID, cb);
  };

  var ftsDelete = function (cb) {
    storage.unindexContent(contentID, cb);
  };

  async.parallel([
    kvDelete,
    ftsDelete
  ], function (err) {
    if (err) {
      err.statusCode = err.statusCode || err.status || 500;

      logger.error('Unable to delete content.', {
        event: 'content delete',
        statusCode: err.statusCode,
        errMessage: err.message,
        apikeyName: req.apikeyName,
        contentID: contentID,
        totalReqDuration: Date.now() - reqStart
      });

      return next(err);
    }

    res.send(204);

    logger.info('Content deletion successful.', {
      event: 'content delete',
      statusCode: 204,
      apikeyName: req.apikeyName,
      contentID: contentID,
      totalReqDuration: Date.now() - reqStart
    });

    next();
  });
};
