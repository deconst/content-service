// Issue and revoke API keys.

var crypto = require('crypto');
var async = require('async');
var restify = require('restify');
var config = require('./config');
var storage = require('./storage');
var log = require('./logging').getLogger();

/**
 * @description Generate a fresh API key.
 */
function generateKey (callback) {
  crypto.randomBytes(128, function (err, buf) {
    if (err) return callback(err);

    callback(null, {
      apikey: buf.toString('hex')
    });
  });
}

/**
 * @description Store an API key in Mongo.
 */
function storeKey (name, result, callback) {
  var key = {
    name: name,
    apikey: result.apikey
  };

  storage.storeKey(key, function (err) {
    callback(err, key);
  });
}

/**
 * @description Remove an API key from Mongo.
 */
function removeKey (key, callback) {
  storage.deleteKey(key, callback);
}

exports.issue = function (req, res, next) {
  var name = req.query.named;

  if (!name) {
    log.warn('Attempt to issue an API key without a name.');

    return next(new restify.MissingParameterError('You must specify a name for the API key'));
  }

  log.info('Issuing an API key for [' + name + ']');

  async.waterfall([
    generateKey,
    async.apply(storeKey, name)
  ], function (err, result) {
    next.ifError(err);

    res.json(200, {
      apikey: result.apikey
    });
    next();
  });
};

exports.revoke = function (req, res, next) {
  if (req.apikey === req.params.key) {
    log.warn('Attempt to revoke the admin key.');

    return next(new restify.InvalidArgumentError('You cannot revoke your own API key.'));
  }

  log.info('Revoking an API key.');

  removeKey(req.params.key, function (err) {
    next.ifError(err);

    res.send(204);
    next();
  });
};
