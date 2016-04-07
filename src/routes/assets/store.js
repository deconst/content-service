'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const async = require('async');
const logger = require('../../logging').getLogger();
const storage = require('../../storage');

exports.handler = function (req, res, next) {
  var originalAssetNames = [];
  var assetData = Object.getOwnPropertyNames(req.files).map(function (key) {
    var asset = req.files[key];
    asset.key = key;
    originalAssetNames.push(key);
    return asset;
  });

  logger.debug({
    action: 'assetstore',
    apikeyName: req.apikeyName,
    assetCount: assetData.length,
    originalAssetNames: originalAssetNames,
    message: withAssetList('Asset upload request received', originalAssetNames)
  });

  var reqStart = Date.now();

  async.map(assetData, makeAssetHandler(req.query.named), function (err, results) {
    if (err) {
      var statusCode = err.statusCode || 500;

      logger.error({
        action: 'assetstore',
        statusCode: statusCode,
        apikeyName: req.apikeyName,
        error: err.message,
        stack: err.stack,
        message: withAssetList('Unable to upload one or more assets', originalAssetNames)
      });

      res.send(statusCode, {
        apikeyName: req.apikeyName,
        error: 'Unable to upload one or more assets.'
      });

      return next(err);
    }

    var summary = {};
    results.forEach(function (result) {
      summary[result.original] = result.publicURL;
    });
    logger.info({
      action: 'assetstore',
      statusCode: 200,
      apikeyName: req.apikeyName,
      totalReqDuration: Date.now() - reqStart,
      message: withAssetList('All assets have been uploaded successfully', originalAssetNames)
    });

    res.send(summary);
    next();
  });
};

/**
 * @description Create and return a function that processes a single asset.
 */
const makeAssetHandler = function (shouldName) {
  return function (asset, callback) {
    logger.debug({
      action: 'assetstore',
      originalAssetName: asset.name,
      message: 'Asset upload request received.'
    });

    var steps = [
      async.apply(fingerprintAsset, asset),
      publishAsset
    ];

    if (shouldName) {
      steps.push(nameAsset);
    }

    async.waterfall(steps, callback);
  };
};

/**
 * @description Calculate a checksum of an uploaded file's contents to generate
 *   the fingerprinted asset name.
 */
const fingerprintAsset = function (asset, callback) {
  var sha256sum = crypto.createHash('sha256');
  var assetFile = fs.createReadStream(asset.path);
  var chunks = [];

  assetFile.on('data', function (chunk) {
    sha256sum.update(chunk);
    chunks.push(chunk);
  });

  assetFile.on('error', callback);

  assetFile.on('end', function () {
    var digest = sha256sum.digest('hex');
    var ext = path.extname(asset.name);
    var basename = path.basename(asset.name, ext);
    var fingerprinted = basename + '-' + digest + ext;

    logger.debug({
      action: 'assetstore',
      originalAssetName: asset.name,
      assetFilename: fingerprinted,
      assetContentType: asset.type,
      message: 'Asset fingerprinted successfully.'
    });

    callback(null, {
      key: asset.key,
      original: asset.name,
      chunks: chunks,
      filename: fingerprinted,
      type: asset.type
    });
  });
};

/**
 * @description Upload an asset's contents to the asset container.
 */
const publishAsset = function (asset, callback) {
  storage.storeAsset(asset, function (err, asset) {
    if (err) {
      return callback(err);
    }

    logger.debug({
      action: 'assetstore',
      assetFilename: asset.filename,
      assetContentType: asset.type,
      message: 'Asset uploaded successfully.'
    });

    callback(null, asset);
  });
};

/**
 * @description Give this asset a name. The final name and CDL URI of this
 *   asset will be included in all outgoing metadata envelopes, for use by
 *   layouts.
 */
const nameAsset = function (asset, callback) {
  storage.nameAsset(asset, function (err, asset) {
    if (err) {
      return callback(err);
    }

    logger.debug({
      action: 'assetstore',
      originalAssetFilename: asset.original,
      assetName: asset.key,
      message: 'Asset named successfully.'
    });

    callback(null, asset);
  });
};

/**
 * @description Append a list of asset names to a message before it's logged.
 */
const withAssetList = function (message, originalAssetNames) {
  var subset = originalAssetNames.slice(0, 3);

  if (originalAssetNames.length > 3) {
    subset.push('..');
  }

  var joined = subset.join(', ');

  return message + ': ' + joined + '.';
};
