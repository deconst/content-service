/*
 * Suite-global initialization that should occur before any other files are required. It's probably
 * a code smell that I have to do this.
 */

var config = require('../../src/config');

config.configure({
  RACKSPACE_USERNAME: "me",
  RACKSPACE_APIKEY: "12345",
  RACKSPACE_REGION: "space",
  ADMIN_APIKEY: "12345",
  CONTENT_CONTAINER: "the-content-container",
  ASSET_CONTAINER: "the-asset-container",
  MONGODB_URL: "mongodb-url",
  CONTENT_LOG_LEVEL: "debug"
});
