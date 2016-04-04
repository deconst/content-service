'use strict';

const async = require('async');
const storage = require('../../storage');
const logger = require('../../logging').getLogger();

/**
 * @description Store new content into the content service.
 */
module.exports = function (req, res, next) {
  var reqStart = Date.now();
  var contentID = req.params.id;
  var envelope = req.body;

  logger.debug({
    action: 'contentstore',
    apikeyName: req.apikeyName,
    contentID: contentID,
    message: 'Content storage request received.'
  });

  // Store the envelope in the primary key-value storage engine.
  var kvStore = function (cb) {
    storage.storeContent(contentID, envelope, cb);
  };

  // Index the envelope in the full text search storage engine.
  var ftsStore = function (cb) {
    storage.indexContent(contentID, envelope, cb);
  };

  async.parallel([
    kvStore,
    ftsStore
  ], function (err) {
    if (err) {
      logger.error({
        action: 'contentstore',
        statusCode: err.statusCode || 500,
        apikeyName: req.apikeyName,
        contentID: req.params.id,
        error: err.message,
        stack: err.stack,
        totalReqDuration: Date.now() - reqStart,
        message: 'Unable to store content.'
      });

      return next(err);
    }

    res.send(204);

    logger.info({
      action: 'contentstore',
      statusCode: 204,
      apikeyName: req.apikeyName,
      contentID: contentID,
      totalReqDuration: Date.now() - reqStart,
      message: 'Content storage successful.'
    });

    next();
  });
};
