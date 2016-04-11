'use strict';

// Test for the existance of assets

const async = require('async');
const storage = require('../../storage');
const fingerprinted = require('./store').fingerprinted;

/**
 * @description Accept an object mapping asset filenames to SHA-256 checksums of their content.
 * Return an object mapping each filename to its public CDN URL (if it exists) or null (if it
 * doesn't.)
 */
exports.handler = function (req, res, next) {
  req.logger.debug('Request body', { body: req.body });

  const assetMap = req.body;
  const assetFilenames = Object.keys(assetMap);
  const results = {};

  req.logger.debug('Checking asset existence', { assetCount: assetFilenames.length });

  const assetCheck = (assetFilename, cb) => {
    const fingerprint = assetMap[assetFilename];
    const internalName = fingerprinted(assetFilename, fingerprint);

    storage.assetExists(internalName, (err, exists) => {
      if (err) {
        req.logger.reportError('Unable to check for asset', err, {
          payload: { assetFilename, fingerprint }
        });

        results[assetFilename] = null;
        return cb(null);
      }

      if (exists) {
        results[assetFilename] = storage.assetURLPrefix() + internalName;
      } else {
        results[assetFilename] = null;
      }

      cb(null);
    });
  };

  async.each(assetFilenames, assetCheck, (err) => {
    if (err) {
      req.logger.reportError('Unable to check asset existence', err);
      return next(err);
    }

    res.send(200, results);
    next();
  });
};
