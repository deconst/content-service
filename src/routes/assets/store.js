'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const async = require('async');
const logger = require('../../logging').getLogger();
const storage = require('../../storage');

exports.handler = function (req, res, next) {
  const reqStart = Date.now();
  const isNamed = req.query.named;

  const names = [];
  const assets = [];

  Object.getOwnPropertyNames(req.files).forEach((name) => {
    const upload = req.files[name];

    assets.push({
      name,
      filename: upload.name,
      type: upload.type,
      size: upload.size,
      getReadStream: () => fs.createReadStream(upload.path)
    });
    names.push(name);
  });

  logger.debug(withAssetList('Asset upload request received', names), {
    action: 'assetstore',
    apikeyName: req.apikeyName,
    assetCount: assets.length,
    assetNames: names
  });

  async.map(assets, makeAssetHandler(isNamed), (err, results) => {
    if (err) {
      const statusCode = err.statusCode || 500;

      logger.error(withAssetList('Unable to upload one or more assets', names), {
        action: 'assetstore',
        statusCode: statusCode,
        apikeyName: req.apikeyName,
        error: err.message,
        stack: err.stack
      });

      res.send(statusCode, {
        apikeyName: req.apikeyName,
        error: 'Unable to upload one or more assets.'
      });

      return next(err);
    }

    const summary = {};
    results.forEach((result) => summary[result.filename] = result.publicURL);

    res.send(summary);

    logger.info(withAssetList('All assets have been uploaded successfully', names), {
      action: 'assetstore',
      statusCode: 200,
      apikeyName: req.apikeyName,
      totalReqDuration: Date.now() - reqStart
    });

    next();
  });
};

/**
 * @description Create and return a function that processes a single asset.
 */
const makeAssetHandler = function (shouldName) {
  return (asset, callback) => {
    logger.debug('Uploading asset', {
      action: 'assetstore',
      assetName: asset.name
    });

    const steps = [
      makeAssetFingerprinter(asset),
      makeAssetPublisher(asset)
    ];

    if (shouldName) {
      steps.push(makeAssetNamer(asset));
    }

    async.series(steps, (err) => {
      if (err) return callback(err);
      callback(null, asset);
    });
  };
};

/**
 * @description Calculate a checksum of an uploaded file's contents to generate
 *   the fingerprinted asset name.
 */
const makeAssetFingerprinter = function (asset) {
  return (callback) => {
    const stream = asset.getReadStream();
    const sha256sum = crypto.createHash('sha256');

    stream.on('data', (chunk) => sha256sum.update(chunk));

    stream.on('error', callback);

    stream.on('end', () => {
      const digest = sha256sum.digest('hex');
      const ext = path.extname(asset.filename);
      const basename = path.basename(asset.filename, ext);
      const fingerprinted = `${basename}-${digest}${ext}`;

      asset.fingerprinted = fingerprinted;

      logger.debug('Asset fingerprinted.', {
        action: 'assetstore',
        assetName: asset.name,
        assetFilename: fingerprinted,
        assetContentType: asset.type
      });

      callback(null);
    });
  };
};

/**
 * @description Upload an asset's contents to the asset container.
 */
const makeAssetPublisher = function (asset) {
  return (callback) => {
    const stream = asset.getReadStream();

    storage.storeAsset(stream, asset.fingerprinted, asset.type, (err, publicURL) => {
      if (err) return callback(err);

      asset.publicURL = publicURL;

      logger.debug('Asset uploaded.', {
        action: 'assetstore',
        assetFilename: asset.fingerprinted,
        assetPublicURL: asset.publicURL,
        assetContentType: asset.type
      });

      callback(null);
    });
  };
};

/**
 * @description Give this asset a name. The final name and CDL URI of this
 *   asset will be included in all outgoing metadata envelopes, for use by
 *   layouts.
 */
const makeAssetNamer = function (asset) {
  return (callback) => {
    storage.nameAsset(asset.name, asset.publicURL, (err, asset) => {
      if (err) return callback(err);

      logger.debug('Asset named successfully.', {
        action: 'assetstore',
        assetName: asset.name
      });

      callback(null);
    });
  };
};

/**
 * @description Append a list of asset names to a message before it's logged.
 */
const withAssetList = function (message, names) {
  const subset = names.slice(0, 3);

  if (names.length > 3) {
    subset.push('..');
  }

  const joined = subset.join(', ');
  return `${message}: ${joined}.`;
};
