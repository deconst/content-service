'use strict';

// Issue and revoke API keys.

const crypto = require('crypto');
const async = require('async');
const restify = require('restify');
const storage = require('../storage');

/**
 * @description Generate a fresh API key.
 */
const generateKey = function (callback) {
  crypto.randomBytes(128, function (err, buf) {
    if (err) return callback(err);

    callback(null, { apikey: buf.toString('hex') });
  });
};

/**
 * @description Store an API key in Mongo.
 */
const storeKey = function (name, result, callback) {
  const key = {
    name: name,
    apikey: result.apikey
  };

  storage.storeKey(key, function (err) {
    callback(err, key);
  });
};

/**
 * @description Remove an API key from Mongo.
 */
const removeKey = function (key, callback) {
  storage.deleteKey(key, callback);
};

exports.issue = function (req, res, next) {
  const keyName = req.query.named;

  if (!keyName) {
    req.logger.warn('Attempt to issue an API key without a name.');

    return next(new restify.MissingParameterError('You must specify a name for the API key'));
  }

  async.waterfall([
    generateKey,
    async.apply(storeKey, keyName)
  ], function (err, result) {
    if (err) {
      req.logger.reportError('Unable to issue API key', { keyName });
      next(err);
    }

    res.json(200, { apikey: result.apikey });
    req.logger.reportSuccess('API key issued', { keyName });
    next();
  });
};

exports.revoke = function (req, res, next) {
  if (req.apikey === req.params.key) {
    req.logger.warn('Attempt to revoke the admin key.');

    return next(new restify.InvalidArgumentError('You cannot revoke your own API key.'));
  }

  req.logger.debug('Revoking an API key.');

  removeKey(req.params.key, function (err) {
    if (err) {
      req.logger.reportError('Unable to revoke an API key', err);
      next(err);
    }

    res.send(204);
    req.logger.reportSuccess('API key revoked');
    next();
  });
};
