/*
 * Unit tests for the content service.
 */

require("./helpers/before");

var chai = require("chai");
var dirtyChai = require("dirty-chai");

chai.use(dirtyChai);
var expect = chai.expect;

var request = require("supertest");
var storage = require("../src/storage");
var authhelper = require("./helpers/auth");
var server = require("../src/server");

describe.only("/content", function() {
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
        .expect(204)
        .end(function (err, res) {
          if (err) return done(err);

          var uploaded = mocks.mockClient.uploaded;
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

    it("indexes content by category", function (done) {
      var doc = {
        title: "title goes here",
        publish_date: "Tue, 05 Aug 2014 23:59:00 -0400",
        body: "something",
        tags: ["tag1", "tag2"],
        categories: ["cat1", "cat2"]
      };

      request(server.create())
        .put("/content/tagged")
        .set("Authorization", authhelper.AUTH_USER)
        .send(doc)
        .expect(204)
        .end(function (err, res) {
          if (err) return done(err);

          var contents = mocks.mockDB.collection("envelopes").find().toArray();

          expect(contents).to.deep.include({
            contentID: "tagged",
            title: "title goes here",
            publish_date: Date.parse("Tue, 05 Aug 2014 23:59:00 -0400"),
            tags: ["tag1", "tag2"],
            categories: ["cat1", "cat2"]
          });

          done();
        });
    });

  });

  describe("#retrieve", function () {

    it("retrieves existing content from Cloud Files", function (done) {
      mocks.mockClient.content["foo%26bar"] = '{ "expected": "json" }';

      request(server.create())
        .get("/content/foo%26bar")
        .expect("Content-Type", "application/json")
        .expect(200)
        .expect({
          assets: [],
          envelope: { expected: "json" }
        }, done);
    });

    it("collects related documents when a 'queries' attribute is present", function (done) {
      mocks.mockClient.content.hasqueries = JSON.stringify({
        queries: {
          somename: { categories: "sample" },
          anothername: { tags: "important" }
        },
        body: ".."
      });

      mocks.mockDB.addCollection("envelopes", [
        { categories: ["sample", "other"], title: "zero", contentID: "id0" },
        { categories: ["sample", "blerp"], title: "one", contentID: "id1" },
        { categories: ["nope", "none"], tags: ["uhuh"], title: "two", contentID: "id2" },
        { tags: ["important"], title: "three", contentID: "id3" },
        { tags: ["important", "extra"], title: "four", contentID: "id4" }
      ]);

      request(server.create())
        .get("/content/hasqueries")
        .expect("Content-Type", "application/json")
        .expect(200)
        .expect({
          assets: {},
          envelope: {
            body: ".."
          },
          results: {
            somename: [
              { categories: ["sample", "other"], title: "zero", contentID: "id0" },
              { categories: ["sample", "blerp"], title: "one", contentID: "id1" }
            ],
            anothername: [
              { tags: ["important"], title: "three", contentID: "id3" },
              { tags: ["important", "extra"], title: "four", contentID: "id4" }
            ]
          }
        }, done);
    });

  });

  describe("#delete", function () {

    it("deletes content from Cloud Files", function (done) {
      mocks.mockClient.content["foo%26bar"] = '{ "existing": "json" }';

      request(server.create())
        .delete("/content/foo%26bar")
        .set("Authorization", authhelper.AUTH_USER)
        .expect(204)
        .end(function (err, res) {
          if (err) return done(err);

          var deletions = mocks.mockClient.deleted;
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
