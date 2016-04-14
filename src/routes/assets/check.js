'use strict';

// Test for the existance of assets

const _ = require('lodash');
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
  const localResults = {};

  req.logger.debug('Checking asset fingerprints', { assetCount: assetFilenames.length });

  const assetCheck = (assetFilename, cb) => {
    const fingerprint = query[assetFilename];
    const internalName = fingerprinted(assetFilename, fingerprint);

    storage.assetExists(internalName, (err, exists) => {
      if (err) {
        req.logger.reportError('Unable to check for asset', err, {
          payload: { assetFilename, fingerprint }
        });

        localResults[assetFilename] = null;
        return cb(null);
      }

      if (exists) {
        localResults[assetFilename] = storage.assetURLPrefix() + internalName;
      } else {
        localResults[assetFilename] = null;
      }

      cb(null);
    });
  };

  async.each(assetFilenames, assetCheck, (err) => {
    if (err) {
      req.logger.reportError('Unable to check asset fingerprints', err);
      return next(err);
    }

    const finish = (err, results) => {
      if (err) return next(err);

      req.logger.reportSuccess('Asset fingerprint query', { assetCount: assetFilenames.length });
      res.send(200, results);
      next();
    };

    if (config.proxyUpstream()) {
      const subquery = {};
      _.forOwn(localResults, (publicURL, pathname) => {
        if (publicURL === null) subquery[pathname] = query[pathname];
      });

      if (Object.keys(subquery).length > 0) {
        checkUpstream(req.logger, subquery, (err, subresults) => {
          if (err) return finish(err);

          finish(null, _.assign(localResults, subresults));
        });
      } else {
        finish(null, localResults);
      }
    } else {
      finish(null, localResults);
    }
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
