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
        .put('/content/foo%26bar%2F')
        .set('Authorization', authHelper.AUTH_USER)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send('{ "body": "something" }')
        .expect(204)
        .end(function (err, res) {
          if (err) return done(err);

          storage.getContent('foo&bar/', function (err, uploaded) {
            expect(err).to.be.null();
            expect(uploaded).to.deep.equal({ body: 'something' });

            done();
          });
        });
    });

    it('makes the content available to full-text search', function (done) {
      request(server.create())
        .put('/content/foobar')
        .set('Authorization', authHelper.AUTH_USER)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send('{ "title": "aaa", "body": "bbb ccc ddd" }')
        .expect(204)
        .end(function (err, res) {
          if (err) return done(err);

          storage.queryContent('ccc', null, 1, 10, function (err, results) {
            expect(err).to.be.null();
            expect(results.hits.total).to.equal(1);

            var result = results.hits.hits[0];
            expect(result._id).to.equal('foobar');
            expect(result._source.title).to.equal('aaa');

            done();
          });
        });
    });

    it('trims HTML from content before full-text indexing', function (done) {
      request(server.create())
        .put('/content/foobar')
        .set('Authorization', authHelper.AUTH_USER)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send('{ "title": "aaa", "body": "<p class=\'nope\'>bbb ccc ddd</p>" }')
        .expect(204)
        .end(function (err, res) {
          if (err) return done(err);

          storage.queryContent('nope', null, 1, 10, function (err, results) {
            expect(err).to.be.null();
            expect(results.hits.total).to.equal(0);

            done();
          });
        });
    });

    it('skips envelopes with unsearchable set to true', function (done) {
      request(server.create())
        .put('/content/foobar')
        .set('Authorization', authHelper.AUTH_USER)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send('{ "title": "aaa", "body": "bbb ccc ddd", "unsearchable": true }')
        .expect(204)
        .end(function (err, res) {
          if (err) return done(err);

          storage.queryContent('ccc', null, 1, 10, function (err, results) {
            expect(err).to.be.null();
            expect(results.hits.total).to.equal(0);

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
      storage.storeContent('what&huh', { body: 'expected' }, function (err) {
        expect(err).not.to.exist();

        request(server.create())
          .get('/content/what%26huh')
          .expect('Content-Type', 'application/json')
          .expect(200)
          .expect({
            assets: [],
            envelope: {
              body: 'expected'
            }
          }, done);
      });
    });
  });

  describe('#delete', function () {
    beforeEach(function (done) {
      storage.storeContent('er&okay', { body: 'expected' }, done);
    });
    beforeEach(function (done) {
      storage.indexContent('er&okay', { body: 'expected' }, done);
    });

    it('requires authentication', function (done) {
      authHelper.ensureAuthIsRequired(
        request(server.create())
          .delete('/content/wat%26nope'),
        done);
    });

    it('deletes content from Cloud Files', function (done) {
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

    it('deletes content from Elasticsearch', function (done) {
      request(server.create())
        .delete('/content/er%26okay')
        .set('Authorization', authHelper.AUTH_USER)
        .expect(204)
        .end(function (err, res) {
          if (err) return done(err);

          storage.queryContent('expected', null, 1, 10, function (err, found) {
            expect(err).to.be.null();
            expect(found.hits.total).to.equal(0);
            expect(found.hits.hits.length).to.equal(0);

            done();
          });
        });
    });
  });
});
