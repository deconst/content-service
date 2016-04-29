'use strict';

// Test for the existance of assets

const async = require('async');
const request = require('request');
const restify = require('restify');
const urljoin = require('urljoin');
const config = require('../../config');
const storage = require('../../storage');
const fingerprinted = require('./store').fingerprinted;

/**
 * @description Accept an object mapping asset filenames to SHA-256 checksums of their content.
 * Return an object mapping each filename to its public CDN URL (if it exists) or null (if it
 * doesn't.)
 */
exports.handler = function (req, res, next) {
  const query = req.body;
  const assetFilenames = Object.keys(query);
  let results = {};

  req.logger.debug('Checking asset fingerprints', { assetCount: assetFilenames.length });

  // Query upstream first.
  const queryUpstream = (cb) => {
    if (config.proxyUpstream() && assetFilenames.length > 0) {
      checkUpstream(req.logger, query, (err, r) => {
        if (err) return cb(err);

        results = r;
        cb(null);
      });
    } else {
      cb(null);
    }
  };

  const localAssetCheck = (assetFilename, cb) => {
    // Prefer upstream assets, if they were fetched.
    if (results[assetFilename]) {
      return cb(null);
    }

    const fingerprint = query[assetFilename];
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
        results[assetFilename] = storage.assetPublicURL(internalName);
      } else {
        results[assetFilename] = null;
      }

      cb(null);
    });
  };

  queryUpstream((err) => {
    if (err) {
      req.logger.reportError('Unable to check upstream asset fingerprints', err);
      return next(err);
    }

    async.each(assetFilenames, localAssetCheck, (err) => {
      if (err) {
        req.logger.reportError('Unable to check asset fingerprints', err);
        return next(err);
      }

      req.logger.reportSuccess('Asset fingerprint query', { assetCount: assetFilenames.length });
      res.send(200, results);
      next();
    });
  });
};

const checkUpstream = function (logger, query, callback) {
  const url = urljoin(config.proxyUpstream(), 'checkassets');

  logger.debug('Making an upstream asset fingerprint query', {
    assetCount: Object.keys(query).length
  });

  request({ url, body: query, json: true }, (err, response, body) => {
    if (err) {
      logger.reportError('Unable to query upstream for asset fingerprints', err);
      return callback(new restify.errors.BadGatewayError('Unable to query upstream for asset fingerprints'));
    }

    if (response.statusCode !== 200) {
      logger.reportError('Non-200 status from upstream asset fingerprint check.', null, {
        statusCode: response.statusCode
      });

      return callback(new restify.errors.BadGatewayError('Unable to query upstream for asset fingerprints'));
    }

    callback(null, body);
  });
};
