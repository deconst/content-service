// Authentication middleware.

var
  async = require("async"),
  restify = require("restify"),
  logging = require("./logging"),
  config = require("./config"),
  connection = require("./connection");

var log = logging.getLogger(config.content_log_level());

var credential_rx = /apikey\s*=\s*"?([^"]+)"?/;

/**
 * @description Extract an API key from a request's parsed Authorization header. Emit an error if
 *  no such header is present, or if it's not formed correctly.
 */
var parse_auth = function (auth, callback) {
  if (!auth || !Object.keys(auth).length) {
    return callback(new restify.UnauthorizedError("An API key is required for this endpoint."));
  }

  if (auth.scheme !== "deconst") {
    return callback(new restify.InvalidHeaderError("Your Authorization header specifies an incorrect scheme."));
  }

  var match = credential_rx.exec(auth.credentials);

  if (!match) {
    return callback(new restify.InvalidHeaderError("Your Authorization header does not include an 'apikey' value."));
  }

  callback(null, match[1]);
};

/**
 * @description Access the name associated with an API key. If the key is not valid, emit an
 *   error instead.
 */
var validate_apikey = function (key, callback) {
  // Always accept the admin's API key.
  if (key === config.admin_apikey()) {
    return callback(null, "administrator");
  }

  callback(new restify.UnauthorizedError("The API key you provided is invalid."));
};

/**
 * @description Require an API key on the request. Return a 401 response if no key is present.
 */
exports.requireKey = [
  restify.authorizationParser(),
    function (req, res, next) {
    async.waterfall([
      async.apply(parse_auth, req.authorization),
      validate_apikey
    ], function (err, name) {
      next.ifError(err);

      log.debug("Authenticated as [" + name + "]");
      next();
    });
  }
];
