// Authentication middleware.

var
  async = require("async"),
  restify = require("restify"),
  config = require("./config"),
  connection = require("./connection"),
  log = require("./logging").getLogger();

var credentialRx = /apikey\s*=\s*"?([^"]+)"?/;

/**
 * @description Extract an API key from a request's parsed Authorization header. Emit an error if
 *  no such header is present, or if it's not formed correctly.
 */
var parseAuth = function (auth, callback) {
  if (!auth || !Object.keys(auth).length) {
    return callback(new restify.UnauthorizedError("An API key is required for this endpoint."));
  }

  if (auth.scheme !== "deconst") {
    return callback(new restify.InvalidHeaderError("Your Authorization header specifies an incorrect scheme."));
  }

  var match = credentialRx.exec(auth.credentials);

  if (!match) {
    return callback(new restify.InvalidHeaderError("Your Authorization header does not include an 'apikey' value."));
  }

  callback(null, match[1]);
};

/**
 * @description Access the name associated with an API key. Emit an error if the key is not
 *   recognized, or if adminOnly is true but the key is not an admin key.
 */
var locateKeyname = function (adminOnly, key, callback) {
  // Always accept the admin's API key.
  if (key === config.admin_apikey()) {
    return callback(null, { key: key, name: "administrator"});
  }

  if (adminOnly) {
    return callback(new restify.UnauthorizedError("Only admins may access this endpoint."));
  }

  // Check Mongo for non-admin keys.
  connection.db.collection("apiKeys").find({ apikey: key }).toArray(function (err, docs) {
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
 * @description Create a restify handler that combines parseAuth and locateKeyname to extract and
 *   validate an API key from an incoming request. If the API key is valid, its name will be
 *   attached to the request object. Otherwise, an appropriate error will be generated.
 */
var createAPIKeyHandler = function (adminOnly) {
  return function (req, res, next) {
    async.waterfall([
      async.apply(parseAuth, req.authorization),
      async.apply(locateKeyname, adminOnly)
    ], function (err, result) {
      next.ifError(err);

      log.debug("Request authenticated as [" + result.name + "]");
      req.apikey = result.key;
      req.apikeyName = result.name;
      next();
    });
  };
};

/**
 * @description Require an API key on the request. Return a 401 response if no key is present.
 */
exports.requireKey = [restify.authorizationParser(), createAPIKeyHandler(false)];

/**
 * @description Require an administrator's API key on the request.
 */
exports.requireAdmin = [restify.authorizationParser(), createAPIKeyHandler(true)];
