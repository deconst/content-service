/*
 * Unit tests for API key management.
 */

require("./helpers/before");

var chai = require("chai");
var dirtyChai = require("dirty-chai");

chai.use(dirtyChai);
var expect = chai.expect;

var request = require("supertest");
var storage = require("../src/storage");
var authhelper = require("./helpers/auth");
var config = require("../src/config");
var server = require("../src/server");

describe("/keys", function() {
  beforeEach(function() {
    storage.memory.clear();
    authhelper.install();
  });

  describe("POST", function() {

    it("allows an admin to issue a new key", function(done) {
      request(server.create())
        .post("/keys?named=someone")
        .set("Authorization", 'deconst apikey="12345"')
        .expect(200)
        .expect("Content-Type", "application/json")
        .expect(function(res) {
          var apikey = res.body.apikey;

          expect(apikey).not.to.be.undefined();

          storage.findKeys(apikey, function(err, keys) {
            expect(err).to.be.null();
            expect(keys).to.have.length(1);
            expect(keys[0].name).to.equal("someone");
          });
        })
        .end(done);
    });

    it("requires a key name", function(done) {
      request(server.create())
        .post("/keys")
        .set("Authorization", 'deconst apikey="12345"')
        .expect(409)
        .expect({
          code: "MissingParameter",
          message: "You must specify a name for the API key"
        }, done);
    });

    it("requires authentication", function(done) {
      authhelper.ensureAuthIsRequired(
        request(server.create()).post("/keys?named=mine"),
        done);
    });

    it("prevents non-admins from issuing keys", function(done) {
      authhelper.ensureAdminIsRequired(
        request(server.create()).post("/keys?named=mine"),
        done);
    });
  });

  describe("DELETE", function() {

    it("allows an admin to revoke an existing key", function(done) {
      storage.storeKey({
        apikey: "54321",
        name: "torevoke"
      }, function(err) {
        expect(err).not.to.exist();
      });

      request(server.create())
        .delete("/keys/54321")
        .set("Authorization", authhelper.AUTH_ADMIN)
        .expect(204)
        .expect(function() {
          storage.findKeys("54321", function(err, keys) {
            expect(err).to.be.null();
            expect(keys).to.be.empty();
          });
        })
        .end(done);
    });

    it("requires authentication", function(done) {
      authhelper.ensureAuthIsRequired(
        request(server.create()).delete("/keys/54321"),
        done);
    });

    it("prevents non-admins from revoking keys", function(done) {
      authhelper.ensureAdminIsRequired(
        request(server.create()).delete("/keys/54321"),
        done);
    });

    it("doesn't allow admins to revoke their own key", function(done) {
      request(server.create())
        .delete("/keys/" + authhelper.APIKEY_ADMIN)
        .set("Authorization", authhelper.AUTH_ADMIN)
        .expect(409)
        .expect("Content-Type", "application/json")
        .expect({
          code: "InvalidArgument",
          message: "You cannot revoke your own API key."
        }, done);
    });
  });
});
