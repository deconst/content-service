/*
 * Unit tests for the content service.
 */

 var
   restify = require("restify"),
   request = require("supertest"),
   expect = require("chai").expect,
   connection = require("../src/connection"),
   connmocks = require("./mock/connection"),
   server = require("../src/server");

describe("content", function () {
  var mocks;

  beforeEach(function () {
    mocks = connmocks.install(connection);
  });

  describe("#store", function () {

    it("persists new content into Cloud Files", function (done) {
      request(server.create())
        .put("/content/foo%26bar")
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .send('{ "something": "body" }')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          var uploaded = mocks.mock_client.uploaded;
          expect(uploaded).to.have.length(1);
          expect(uploaded[0].container).to.equal("the-content-container");

          done();
        });
    });

  });

  describe("#retrieve", function () {

    it("retrieves existing content from Cloud Files");

  });

  describe("#delete", function () {

    it("deletes content from Cloud Files");

  });
});
