/*
 * Unit tests for API key management.
 */

var
  request = require("supertest"),
  expect = require("chai").expect,
  connection = require("../src/connection"),
  connmocks = require("./mock/connection"),
  config = require("../src/config"),
  server = require("../src/server");

describe("/keys", function () {
  var mocks;

  beforeEach(function () {
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

    mocks = connmocks.install(connection);
  });

  describe("POST", function () {
    it("requires authentication");

    it("allows an admin to issue a new key", function (done) {
      request(server.create())
        .post("/keys?named=someone")
        .set("Authorization", 'deconst apikey="12345"')
        .expect(200)
        .expect("Content-Type", "application/json")
        .expect(function (res) {
          if (!("apikey" in res.body)) throw new Error("No API key issued");
        })
        .end(done);
    });

    it("prevents non-admins from issuing keys");
  });

  describe("DELETE", function () {
    it("requires authentication");
    it("allows an admin to revoke an existing key");
    it("prevents non-admins from revoking keys");
    it("doesn't allow admins to revoke their own key");
  });
});
