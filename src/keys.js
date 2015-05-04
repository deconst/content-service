// Issue and revoke API keys.

var
  crypto = require('crypto'),
  async = require('async'),
  config = require('./config'),
  connection = require('./connection'),
  logging = require('./logging');

var log = logging.getLogger(config.content_log_level());

/**
 * @description Generate a fresh API key.
 */
function generate_key(callback) {
  crypto.randomBytes(1024, function (err, buf) {
    if (err) return callback(err);

    callback(null, { apikey: buf.toString('hex')});
  });
}

/**
 * @description Store an API key in Mongo.
 */
function store_key(name, result, callback) {
  var doc = { name: name, apikey: result.apikey };

  connection.db.collection("api_keys").insertOne(doc, function (err) {
    if (err) return callback(err);

    callback(null, { apikey: result.apikey });
  });
}

/**
 * @description Remove an API key from Mongo.
 */
function remove_key(key, callback) {
  connection.db.collection("api_keys").deleteOne({ apikey: key}, function (err) {
    if (err) return callback(err);

    callback(null);
  });
}

exports.issue = function(req, res, next) {
  var name = req.query.named;

  if (!name) {
    log.warn("Attempt to issue an API key without a name.");

    res.json(400, { error: "You must specify a name for the API key" });
    return next();
  }

  log.info("Issuing an API key for [" + name + "]");

  async.waterfall([
    generate_key,
    async.apply(store_key, name)
  ], function (err, result) {
    if (err) {
      log.error("Unable to issue an API key.", err);

      res.json(500, { error: "Unable to issue an API key!" });
      return next();
    }

    res.json(200, { apikey: result.apikey });
    next();
  });
};

exports.revoke = function(req, res, next) {
  log.info("Revoking an API key");

  remove_key(req.params.key, function (err) {
    if (err) {
      log.error("Unable to revoke an API key.", err);

      res.json(500, { error: "Unable to revoke an API key"});
      return next();
    }

    res.send(204);
    next();
  });
};
