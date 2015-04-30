/*
 * Tests for the environment variable configuration.
 */

var
  expect = require("chai").expect,
  config = require("../src/config");

describe("config", function () {
  it("sets variables from the environment", function () {
    config.configure({
      RACKSPACE_USERNAME: "me",
      RACKSPACE_APIKEY: "12345",
      RACKSPACE_REGION: "space",
      CONTENT_CONTAINER: "the-content-container",
      ASSET_CONTAINER: "the-asset-container",
      MONGODB_URL: "mongodb-url",
      CONTENT_LOG_LEVEL: "debug"
    });

    expect(config.rackspace_username()).to.equal("me");
    expect(config.rackspace_apikey()).to.equal("12345");
    expect(config.rackspace_region()).to.equal("space");
    expect(config.content_container()).to.equal("the-content-container");
    expect(config.asset_container()).to.equal("the-asset-container");
    expect(config.mongodb_url()).to.equal("mongodb-url");
    expect(config.content_log_level()).to.equal("debug");
  });
});
