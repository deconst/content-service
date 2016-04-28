'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const async = require('async');
const storage = require('../../storage');

exports.handler = function (req, res, next) {
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

  req.logger.debug(withAssetList('Asset upload request received', names), {
    assetCount: assets.length,
    assetNames: names
  });

  async.map(assets, makeAssetHandler(req.logger, isNamed), (err, results) => {
    if (err) {
      const statusCode = err.statusCode || 500;

      req.logger.reportError('Unable to upload one or more assets', { statusCode });
      res.send(statusCode, { error: 'Unable to upload one or more assets.' });
      return next(err);
    }

    const summary = {};
    results.forEach((result) => summary[result.filename] = result.publicURL);

    res.send(summary);

    req.logger.reportSuccess(withAssetList('All assets have been uploaded successfully', names));
    next();
  });
};

/**
 * @description Create and return a function that processes a single asset.
 */
const makeAssetHandler = function (logger, shouldName) {
  return (asset, callback) => {
    logger.debug('Uploading asset', { assetName: asset.name });

    const steps = [
      makeAssetFingerprinter(logger, asset),
      makeAssetPublisher(logger, asset)
    ];

    if (shouldName) {
      steps.push(makeAssetNamer(logger, asset));
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
const makeAssetFingerprinter = function (logger, asset) {
  return (callback) => {
    const stream = asset.getReadStream();
    const sha256sum = crypto.createHash('sha256');

    stream.on('data', (chunk) => sha256sum.update(chunk));

    stream.on('error', callback);

    stream.on('end', () => {
      asset.fingerprinted = fingerprinted(asset.filename, sha256sum.digest('hex'));

      logger.debug('Asset fingerprinted.', {
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
const makeAssetPublisher = function (logger, asset) {
  return (callback) => {
    const stream = asset.getReadStream();

    storage.storeAsset(stream, asset.fingerprinted, asset.type, (err, publicURL) => {
      if (err) return callback(err);

      asset.publicURL = publicURL;

      logger.debug('Asset uploaded.', {
        assetFilename: asset.fingerprinted,
        assetPublicURL: asset.publicURL,
        assetContentType: asset.type
      });
      callback(null);
    });
  };
};

/**
 * @description Give this asset a name. The final name and CDN URI of this
 *   asset will be included in all outgoing metadata envelopes, for use by
 *   layouts.
 */
const makeAssetNamer = function (logger, asset) {
  return (callback) => {
    storage.nameAsset(asset.name, asset.publicURL, (err, asset) => {
      if (err) return callback(err);

      logger.debug('Asset named successfully.', { assetName: asset.name });
      callback(null);
    });
  };
};

/**
 * @description Consistenty assemble an asset filename from a local path and a fingerprint.
 */
const fingerprinted = exports.fingerprinted = function (pathname, fingerprint) {
  const ext = path.extname(pathname);
  const basename = path.basename(pathname, ext);
  return `${basename}-${fingerprint}${ext}`;
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
