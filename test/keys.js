/* global describe it beforeEach */

/*
 * Unit tests for API key management.
 */

require('./helpers/before');

var chai = require('chai');
var dirtyChai = require('dirty-chai');

chai.use(dirtyChai);
var expect = chai.expect;

var request = require('supertest');
var storage = require('../src/storage');
var resetHelper = require('./helpers/reset');
var authHelper = require('./helpers/auth');
var server = require('../src/server');

describe('/keys', function () {
  beforeEach(resetHelper);

  describe('POST', function () {
    it('allows an admin to issue a new key', function (done) {
      request(server.create())
        .post('/keys?named=someone')
        .set('Authorization', authHelper.AUTH_ADMIN)
        .expect(200)
        .expect('Content-Type', 'application/json')
        .expect(function (res) {
          var apikey = res.body.apikey;

          expect(apikey).not.to.be.undefined();

          storage.findKeys(apikey, function (err, keys) {
            expect(err).to.be.null();
            expect(keys).to.have.length(1);
            expect(keys[0].name).to.equal('someone');
          });
        })
        .end(done);
    });

    it('requires a key name', function (done) {
      request(server.create())
        .post('/keys')
        .set('Authorization', authHelper.AUTH_ADMIN)
        .expect(409)
        .expect({
          code: 'MissingParameter',
          message: 'You must specify a name for the API key'
        }, done);
    });

    it('requires authentication', function (done) {
      authHelper.ensureAuthIsRequired(
        request(server.create()).post('/keys?named=mine'),
        done);
    });

    it('prevents non-admins from issuing keys', function (done) {
      authHelper.ensureAdminIsRequired(
        request(server.create()).post('/keys?named=mine'),
        done);
    });
  });

  describe('DELETE', function () {
    it('allows an admin to revoke an existing key', function (done) {
      request(server.create())
        .delete('/keys/' + authHelper.APIKEY_USER)
        .set('Authorization', authHelper.AUTH_ADMIN)
        .expect(204)
        .expect(function () {
          storage.findKeys(authHelper.APIKEY_USER, function (err, keys) {
            expect(err).to.be.null();
            expect(keys).to.be.empty();
          });
        })
        .end(done);
    });

    it('requires authentication', function (done) {
      authHelper.ensureAuthIsRequired(
        request(server.create()).delete('/keys/54321'),
        done);
    });

    it('prevents non-admins from revoking keys', function (done) {
      authHelper.ensureAdminIsRequired(
        request(server.create()).delete('/keys/54321'),
        done);
    });

    it("doesn't allow admins to revoke their own key", function (done) {
      request(server.create())
        .delete('/keys/' + authHelper.APIKEY_ADMIN)
        .set('Authorization', authHelper.AUTH_ADMIN)
        .expect(409)
        .expect('Content-Type', 'application/json')
        .expect({
          code: 'InvalidArgument',
          message: 'You cannot revoke your own API key.'
        }, done);
    });
  });
});
