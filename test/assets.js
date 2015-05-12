/*
 * Unit tests for the /asset endpoint.
 */

var
  restify = require("restify"),
  request = require("supertest"),
  connection = require("../src/connection"),
  connmocks = require("./mock/connection"),
  authhelper = require("./helpers/auth"),
  server = require("../src/server");

describe("/assets", function() {
  var mocks;

  beforeEach(function () {
    mocks = connmocks.install(connection);
    authhelper.install();
  });

  it("accepts an asset file and produces a fingerprinted filename", function(done) {
    // shasum -a 256 test/fixtures/asset-file.txt
    var finalName =
      "https://example.com/fake/cdn/url/" +
      "asset-file-0a1b4ceeaee9f0b7325a5dbdb93497e1f8c98d03b6f2518084294faa3452efc1.txt";

    request(server.create())
      .post("/assets")
      .set("Authorization", authhelper.AUTH_USER)
      .attach("first", "test/fixtures/asset-file.txt")
      .expect(200)
      .expect("Content-Type", /json/)
      .expect({ "asset-file.txt": finalName }, done);
  });

  it("requires authentication", function(done) {
    authhelper.ensureAuthIsRequired(
      request(server.create())
        .post("/assets")
        .attach("first", "test/fixtures/asset-file.txt"),
      done);
  });

});
