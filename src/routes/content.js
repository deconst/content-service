// Store, retrieve, and delete metadata envelopes.

var async = require('async');
var assets = require('./assets');
var storage = require('../storage');
var log = require('../logging').getLogger();

/**
 * @description Download the raw metadata envelope from Cloud Files.
 */
function downloadContent (contentID, callback) {
  storage.getContent(contentID, function (err, envelope) {
    if (err) return callback(err);

    callback(null, { envelope: envelope });
  });
}

/**
 * @description Inject asset variables included from the /assets endpoint into
 *   an outgoing metadata envelope.
 */
function injectAssetVars (doc, callback) {
  assets.enumerateNamed(function (err, assets) {
    if (err) {
      return callback(err);
    }

    doc.assets = assets;
    callback(null, doc);
  });
}

/**
 * @description Store new content into the content service.
 */
exports.store = function (req, res, next) {
  var reqStart = Date.now();
  var contentID = req.params.id;
  var envelope = req.body;

  log.debug({
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
      log.error({
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

    log.info({
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

/**
 * @description Retrieve content from the store by content ID.
 */
exports.retrieve = function (req, res, next) {
  log.debug({
    action: 'contentretrieve',
    contentID: req.params.id,
    message: 'Content ID request received.'
  });

  var reqStart = Date.now();

  async.waterfall([
    async.apply(downloadContent, req.params.id),
    injectAssetVars
  ], function (err, doc) {
    if (err) {
      var message = 'Unable to retrieve content.';
      if (err.statusCode && err.statusCode === 404) {
        message = 'No content for ID [' + req.params.id + ']';
      }

      log.error({
        action: 'contentretrieve',
        statusCode: err.statusCode || 500,
        contentID: req.params.id,
        error: err.message,
        stack: err.stack,
        message: message
      });

      return next(err);
    }

    res.json(doc);

    log.info({
      action: 'contentretrieve',
      statusCode: 200,
      contentID: req.params.id,
      totalReqDuration: Date.now() - reqStart,
      message: 'Content request successful.'
    });

    next();
  });
};

/**
 * @description Delete a piece of previously stored content by content ID.
 */
exports.delete = function (req, res, next) {
  log.debug({
    action: 'contentdelete',
    apikeyName: req.apikeyName,
    contentID: req.params.id,
    message: 'Content deletion request received.'
  });

  var reqStart = Date.now();

  storage.deleteContent(req.params.id, function (err) {
    if (err) {
      log.error({
        action: 'contentdelete',
        statusCode: err.statusCode || 500,
        apikeyName: req.apikeyName,
        contentID: req.params.id,
        totalReqDuration: Date.now() - reqStart,
        message: 'Unable to delete content.'
      });

      return next(err);
    }

    res.send(204);

    log.info({
      action: 'contentdelete',
      statusCode: 204,
      apikeyName: req.apikeyName,
      contentID: req.params.id,
      totalReqDuration: Date.now() - reqStart,
      message: 'Content deletion successful.'
    });

    next();
  });
};
