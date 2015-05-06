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
 * @description Access the name associated with an API key. Emit an error if the key is not
 *   recognized, or if admin_only is true but the key is not an admin key.
 */
var locate_keyname = function (admin_only, key, callback) {
  // Always accept the admin's API key.
  if (key === config.admin_apikey()) {
    return callback(null, { key: key, name: "administrator"});
  }

  if (admin_only) {
    return callback(new restify.UnauthorizedError("Only admins may access this endpoint."));
  }

  // Check Mongo for non-admin keys.
  connection.db.collection("api_keys").find({ apikey: key }).toArray(function (err, docs) {
    if (err) return callback(err);

    if (!docs.length) {
      return callback(new restify.UnauthorizedError("The API key you provided is invalid."));
    }

    if (docs.length !== 1) {
      log.error("Expected one API key document, but got " + docs.length + ".", docs);
    }

    callback(null, { key: key, name: docs[0].name});
  });
};

/**
 * @description Create a restify handler that combines parse_auth and locate_keyname to extract and
 *   validate an API key from an incoming request. If the API key is valid, its name will be
 *   attached to the request object. Otherwise, an appropriate error will be generated.
 */
var create_apikey_handler = function (admin_only) {
  return function (req, res, next) {
    async.waterfall([
      async.apply(parse_auth, req.authorization),
      async.apply(locate_keyname, admin_only)
    ], function (err, result) {
      next.ifError(err);

      log.debug("Request authenticated as [" + result.name + "]");
      req.apikey = result.key;
      req.apikey_name = result.name;
      next();
    });
  };
};

/**
 * @description Require an API key on the request. Return a 401 response if no key is present.
 */
exports.require_key = [restify.authorizationParser(), create_apikey_handler(false)];

/**
 * @description Require an administrator's API key on the request.
 */
exports.require_admin = [restify.authorizationParser(), create_apikey_handler(true)];
