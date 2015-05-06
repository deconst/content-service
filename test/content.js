/*
 * Unit tests for the content service.
 */

var
  request = require("supertest"),
  expect = require("chai").expect,
  connection = require("../src/connection"),
  connmocks = require("./mock/connection"),
  authhelper = require("./helpers/auth"),
  server = require("../src/server");

describe("/content", function () {
  var mocks;

  beforeEach(function () {
    mocks = connmocks.install(connection);
    authhelper.install();
  });

  describe("#store", function () {

    it("persists new content into Cloud Files", function (done) {
      request(server.create())
        .put("/content/foo%26bar")
        .set("Authorization", authhelper.AUTH_USER)
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

    it("requires authentication", function (done) {
      authhelper.ensureAuthIsRequired(
        request(server.create())
          .put("/content/something")
          .send({ thing: "stuff" }),
        done);
    });

  });

  describe("#retrieve", function () {

    it("retrieves existing content from Cloud Files", function (done) {
      mocks.mock_client.content["foo%26bar"] = '{ "expected": "json" }';

      request(server.create())
        .get("/content/foo%26bar")
        .expect("Content-Type", "application/json")
        .expect(200)
        .expect({
          assets: [],
          envelope: { expected: "json" }
        }, done);
    });

  });

  describe("#delete", function () {

    it("deletes content from Cloud Files", function (done) {
      mocks.mock_client.content["foo%26bar"] = '{ "existing": "json" }';

      request(server.create())
        .delete("/content/foo%26bar")
        .set("Authorization", authhelper.AUTH_USER)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          var deletions = mocks.mock_client.deleted;
          expect(deletions).to.have.length(1);
          expect(deletions[0]).to.equal("foo%26bar");

          done();
        });
    });

    it("requires authentication", function (done) {
      authhelper.ensureAuthIsRequired(
        request(server.create())
          .delete("/content/foo%26bar"),
        done);
    });

  });
});
