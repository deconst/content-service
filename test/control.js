/* global describe it beforeEach */

/*
 * Unit tests for control repository SHA management.
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

describe('/control', function () {
  beforeEach(resetHelper);

  describe('PUT', function () {
    it('requires authentication', function (done) {
      authHelper.ensureAuthIsRequired(
        request(server.create())
          .put('/control')
          .send({ sha: 'c788b1d16d83c0af023c35df0b9edf04e3e1f3b6' }),
        done);
    });

    it('requires a sha element', function (done) {
      request(server.create())
        .put('/control')
        .send({ whoops: 'nope' })
        .set('Authorization', authHelper.AUTH_USER)
        .expect(400)
        .expect({
          code: 'InvalidContent',
          message: 'Missing required "sha" attribute'
        }, done);
    });

    it('requires a valid git sha', function (done) {
      request(server.create())
        .put('/control')
        .send({ sha: 'not-a-sha' })
        .set('Authorization', authHelper.AUTH_USER)
        .expect(400)
        .expect({
          code: 'InvalidContent',
          message: 'Not a valid "sha"'
        }, done);
    });

    it('stores a git sha', function (done) {
      request(server.create())
        .put('/control')
        .send({ sha: 'c788b1d16d83c0af023c35df0b9edf04e3e1f3b6' })
        .set('Authorization', authHelper.AUTH_USER)
        .expect(204)
        .expect(function () {
          storage.getSHA(function (err, sha) {
            expect(err).to.be.null();
            expect(sha).to.equal('c788b1d16d83c0af023c35df0b9edf04e3e1f3b6');
          });
        })
        .end(done);
    });
  });
});
