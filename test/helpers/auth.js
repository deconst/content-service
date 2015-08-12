// Helper functions used to test endpoints that are protected by authentication.

var config = require("../../src/config");
var storage = require("../../src/storage");

exports.APIKEY_ADMIN = "12345";

exports.AUTH_ADMIN = 'deconst apikey="' + exports.APIKEY_ADMIN + '"';

exports.APIKEY_USER = "54321";

exports.AUTH_USER = 'deconst apikey="' + exports.APIKEY_USER + '"';

/**
 * @description Populate the DB mock and the application environment to recognize the fixture
 *   API keys.
 */
exports.install = function() {
  config.configure({
    RACKSPACE_USERNAME: "me",
    RACKSPACE_APIKEY: "11111",
    RACKSPACE_REGION: "space",
    ADMIN_APIKEY: exports.APIKEY_ADMIN,
    CONTENT_CONTAINER: "the-content-container",
    ASSET_CONTAINER: "the-asset-container",
    MONGODB_URL: "mongodb-url",
    CONTENT_LOG_LEVEL: "debug"
  });

  var key = {
    name: "user",
    apikey: exports.APIKEY_USER
  };

  storage.storeKey(key, function() {});
};

/**
 * @description Test helper to ensure that a route fails if no API key is given.
 */
exports.ensureAuthIsRequired = function(action, done) {
  action
    .expect(401)
    .expect("Content-Type", "application/json")
    .expect({
      code: "UnauthorizedError",
      message: "An API key is required for this endpoint."
    }, done);
};

/**
 * @description Test helper to ensure that a route fails if a non-admin API key is given.
 */
exports.ensureAdminIsRequired = function(action, done) {
  action
    .set("Authorization", exports.AUTH_USER)
    .expect(401)
    .expect("Content-Type", "application/json")
    .expect({
      code: "UnauthorizedError",
      message: "Only admins may access this endpoint."
    }, done);
};
