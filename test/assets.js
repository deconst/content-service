/*
 * Unit tests for the /asset endpoint.
 */

require("./helpers/before");

var restify = require("restify");
var request = require("supertest");
var connmocks = require("./mock/connection");
var authhelper = require("./helpers/auth");
var server = require("../src/server");

describe.only("/assets", function() {
  var mocks;

  beforeEach(function() {
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
      .expect({
        "asset-file.txt": finalName
      }, done);
  });

  it("requires authentication", function(done) {
    authhelper.ensureAuthIsRequired(
      request(server.create())
      .post("/assets")
      .attach("first", "test/fixtures/asset-file.txt"),
      done);
  });

  it("lists fingerprinted assets", function(done) {
    var finalName =
      "https://example.com/fake/cdn/url/" +
      "asset-file-0a1b4ceeaee9f0b7325a5dbdb93497e1f8c98d03b6f2518084294faa3452efc1.txt";

    var app = server.create();

    request(app)
      .post("/assets")
      .query({
        named: 'true'
      })
      .set("Authorization", authhelper.AUTH_USER)
      .attach("first", "test/fixtures/asset-file.txt")
      .end(function(err, res) {
        if (err) throw err;

        request(app)
          .get("/assets")
          .expect(200)
          .expect("Content-Type", /json/)
          .expect('{"first":"' + finalName + '"}', done);
      });
  });

});
