// Issue and revoke API keys.

var
  async = require('async'),
  config = require('./config'),
  connection = require('./connection'),
  logging = require('./logging');

var log = logging.getLogger(config.content_log_level());

exports.issue = function(req, res, next) {
  log.info("Issuing an API key for [" + req.query.named + "]");

  res.status(200);
  res.send();

  next();
};

exports.revoke = function(req, res, next) {
  log.info("Revoking an API key");

  res.status(200);
  res.send();

  next();
};
