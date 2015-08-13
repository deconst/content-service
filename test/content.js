/* global describe it beforeEach */

/*
 * Unit tests for the content service.
 */

require('./helpers/before');

var chai = require('chai');
var dirtyChai = require('dirty-chai');

chai.use(dirtyChai);
var expect = chai.expect;

var request = require('supertest');
var storage = require('../src/storage');
var authHelper = require('./helpers/auth');
var resetHelper = require('./helpers/reset');
var server = require('../src/server');

describe('/content', function () {
  beforeEach(resetHelper);

  describe('#store', function () {
    it('persists new content into Cloud Files', function (done) {
      request(server.create())
        .put('/content/foo%26bar')
        .set('Authorization', authHelper.AUTH_USER)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send('{ "something": "body" }')
        .expect(204)
        .end(function (err, res) {
          if (err) return done(err);

          storage.getContent('foo&bar', function (err, uploaded) {
            expect(err).to.be.null();
            expect(JSON.parse(uploaded)).to.deep.equal({ something: 'body' });

            done();
          });
        });
    });

    it('requires authentication', function (done) {
      authHelper.ensureAuthIsRequired(
        request(server.create())
          .put('/content/something')
          .send({
            thing: 'stuff'
          }),
        done);
    });

  });

  describe('#retrieve', function () {
    it('retrieves existing content from Cloud Files', function (done) {
      storage.storeContent('what&huh', '{ "expected": "json" }', function (err) {
        expect(err).not.to.exist();

        request(server.create())
          .get('/content/what%26huh')
          .expect('Content-Type', 'application/json')
          .expect(200)
          .expect({
            assets: [],
            envelope: {
              expected: 'json'
            }
          }, done);
      });
    });

  });

  describe('#delete', function () {
    it('deletes content from Cloud Files', function (done) {
      storage.storeContent('er&okay', '{ "expected": "json" }', function (err) {
        expect(err).not.to.exist();

        request(server.create())
          .delete('/content/er%26okay')
          .set('Authorization', authHelper.AUTH_USER)
          .expect(204)
          .end(function (err, res) {
            if (err) return done(err);

            storage.getContent('er&okay', function (err, uploaded) {
              expect(err).not.to.be.null();
              expect(err.statusCode).to.equal(404);

              done();
            });
          });
      });
    });

    it('requires authentication', function (done) {
      authHelper.ensureAuthIsRequired(
        request(server.create())
          .delete('/content/wat%26nope'),
        done);
    });

  });
});
