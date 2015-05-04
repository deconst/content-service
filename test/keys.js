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

    it("allows an admin to issue a new key", function (done) {
      request(server.create())
        .post("/keys?named=someone")
        .set("Authorization", 'deconst apikey="12345"')
        .expect(200)
        .expect("Content-Type", "application/json")
        .expect(function (res) {
          if (!("apikey" in res.body)) throw new Error("No API key issued");

          var
            apikey = res.body.apikey,
            found = false,
            issued = mocks.mock_db.collection("api_keys").find().toArray();

          issued.forEach(function (each) {
            if (each.apikey === apikey && each.name === "someone") {
              found = true;
            }
          });

          if (!found) throw new Error("Issued API key not found in database");
        })
        .end(done);
    });

    it("requires a key name", function (done) {
      request(server.create())
        .post("/keys")
        .set("Authorization", 'deconst apikey="12345"')
        .expect(400, done);
    });

    it("requires authentication");

    it("prevents non-admins from issuing keys");
  });

  describe("DELETE", function () {
    it("requires authentication");
    it("allows an admin to revoke an existing key");
    it("prevents non-admins from revoking keys");
    it("doesn't allow admins to revoke their own key");
  });
});
