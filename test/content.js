'use strict';
/* global describe it beforeEach */

/*
 * Unit tests for the content service.
 */

require('./helpers/before');

const chai = require('chai');
const dirtyChai = require('dirty-chai');

chai.use(dirtyChai);
const expect = chai.expect;

const path = require('path');
const zlib = require('zlib');
const async = require('async');
const tarfs = require('tar-fs');
const getRawBody = require('raw-body');
const request = require('supertest');
const storage = require('../src/storage');
const authHelper = require('./helpers/auth');
const resetHelper = require('./helpers/reset');
const server = require('../src/server');

const storeAndIndexEnvelope = function (contentID, envelope) {
  return (cb) => {
    storage.storeEnvelope(contentID, envelope, (err) => {
      if (err) return cb(err);

      storage.indexEnvelope(contentID, envelope, cb);
    });
  };
};

const expectStoredEnvelope = function (contentID, envelope) {
  return (cb) => {
    storage.getEnvelope(contentID, (err, c) => {
      if (err) return cb(err);
      expect(c).to.deep.equal(envelope);
      cb();
    });
  };
};

const expectNoEnvelope = function (contentID) {
  return (cb) => {
    storage.getEnvelope(contentID, (err) => {
      expect(err).not.to.be.null();
      expect(err.statusCode).to.equal(404);

      cb(null);
    });
  };
};

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

          storage.getEnvelope('foo&bar/', function (err, uploaded) {
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

          storage.queryEnvelopes('ccc', null, 1, 10, function (err, results) {
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

          storage.queryEnvelopes('nope', null, 1, 10, function (err, results) {
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

          storage.queryEnvelopes('ccc', null, 1, 10, function (err, results) {
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
      storage.storeEnvelope('what&huh', { body: 'expected' }, function (err) {
        expect(err).not.to.exist();

        request(server.create())
          .get('/content/what%26huh')
          .expect('Content-Type', 'application/json')
          .expect(200)
          .expect({
            envelope: {
              body: 'expected'
            }
          }, done);
      });
    });
  });

  describe('#delete', function () {
    beforeEach(storeAndIndexEnvelope('https://one/aaa', { body: 'first' }));
    beforeEach(storeAndIndexEnvelope('https://one/bbb', { body: 'second' }));
    beforeEach(storeAndIndexEnvelope('https://two/aaa', { body: 'third' }));

    it('requires authentication', function (done) {
      authHelper.ensureAuthIsRequired(
        request(server.create())
          .delete('/content/https%3A%2F%2Fone%2Faaa'),
        done);
    });

    it('deletes content from Cloud Files', function (done) {
      request(server.create())
        .delete('/content/https%3A%2F%2Fone%2Faaa')
        .set('Authorization', authHelper.AUTH_USER)
        .expect(204)
        .end(function (err, res) {
          if (err) return done(err);

          expectNoEnvelope('https://one/aaa')(done);
        });
    });

    it('deletes content from Elasticsearch', function (done) {
      request(server.create())
        .delete('/content/https%3A%2F%2Fone%2Faaa')
        .set('Authorization', authHelper.AUTH_USER)
        .expect(204)
        .end(function (err, res) {
          if (err) return done(err);

          storage.queryEnvelopes('first', null, 1, 10, function (err, found) {
            expect(err).to.be.null();
            expect(found.hits.total).to.equal(0);
            expect(found.hits.hits.length).to.equal(0);

            done();
          });
        });
    });

    it('deletes all content with a content ID prefix', function (done) {
      request(server.create())
        .delete('/content/https%3A%2F%2Fone%2F?prefix=true')
        .set('Authorization', authHelper.AUTH_USER)
        .expect(204)
        .end((err, res) => {
          if (err) return done(err);

          async.parallel([
            expectNoEnvelope('https://one/aaa'),
            expectNoEnvelope('https://one/bbb'),
            expectStoredEnvelope('https://two/aaa', { body: 'third' })
          ], done);
        });
    });
  });

  describe('#list', () => {
    beforeEach((done) => {
      async.times(20, (i, next) => {
        storeAndIndexEnvelope(`https://base/${i}`, { body: i.toString() })(next);
      }, done);
    });

    const constructResults = function (numbers) {
      return numbers.map((i) => {
        return {
          contentID: `https://base/${i}`,
          url: `/content/https%3A%2F%2Fbase%2F${i}`
        };
      });
    };

    it('enumerates stored envelopes', (done) => {
      const results = constructResults([
        0, 1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 2, 3, 4, 5, 6, 7, 8, 9
      ]);

      request(server.create())
        .get('/content/')
        .expect(200)
        .expect({ total: 20, results }, done);
    });

    it('limits results by a prefix', (done) => {
      const results = constructResults([1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);

      request(server.create())
        .get('/content/?prefix=https%3A%2F%2Fbase%2F1')
        .expect(200)
        .expect({ total: 11, results }, done);
    });
  });
});

describe('/bulkcontent', function () {
  beforeEach(resetHelper);

  const withFixtureTarball = function (fixtureName, andThen) {
    return (cb) => {
      let tarball = tarfs.pack(path.join(__dirname, 'fixtures', fixtureName)).pipe(zlib.createGzip());
      getRawBody(tarball, (err, tarball) => {
        if (err) return cb(err);

        andThen(tarball, cb);
      });
    };
  };

  it('uploads all envelopes from a tarball', function (done) {
    async.series([
      withFixtureTarball('envelopes', (tarball, cb) => {
        let r = request(server.create())
          .post('/bulkcontent')
          .set('Authorization', authHelper.AUTH_USER)
          .set('Content-Type', 'application/tar+gzip');

        r.write(tarball);

        r.expect(200)
          .expect({ accepted: 2, failed: 0, deleted: 0 })
          .end(cb);
      }),
      expectStoredEnvelope('https://github.com/some/repository/one', {
        title: 'One',
        body: 'Document one'
      }),
      expectStoredEnvelope('https://github.com/some/repository/two', {
        title: 'Two',
        body: 'Document two'
      })
    ], done);
  });

  it('deletes all other envelopes that share a content ID base', function (done) {
    async.series([
      storeAndIndexEnvelope('https://github.com/some/repository/cruft', {
        title: 'Cruft',
        body: 'This should be deleted'
      }),
      withFixtureTarball('envelopes', (tarball, cb) => {
        let r = request(server.create())
          .post('/bulkcontent')
          .set('Authorization', authHelper.AUTH_USER)
          .set('Content-Type', 'application/tar+gzip');

        r.write(tarball);

        r.expect(200)
          .expect({ accepted: 2, failed: 0, deleted: 1 })
          .end(cb);
      }),
      expectStoredEnvelope('https://github.com/some/repository/one', {
        title: 'One',
        body: 'Document one'
      }),
      expectNoEnvelope('https://github.com/some/repository/cruft')
    ], done);
  });
});

describe('/checkcontent', function () {
  beforeEach(resetHelper);

  beforeEach(function (done) {
    storage.storeEnvelope('https://github.com/some/repo/path', {
      title: 'one',
      body: 'one one one'
    }, done);
  });
  beforeEach(function (done) {
    storage.storeEnvelope('https://github.com/some/repo/other', {
      title: 'two',
      body: 'two two two'
    }, done);
  });

  it('reports true for each envelope that is present with a matching fingerprint', function (done) {
    request(server.create())
      .get('/checkcontent')
      .send({
        'https://github.com/some/repo/path': 'f5ac32c93010b9d0a9f7ca98aab0c3daa80580f06e79d238065619948f435a7f',
        'https://github.com/some/repo/other': '2aeb0c4381a573b85f44dc70ecef8c3b9f04c448c787223be43b15ed7146d440',
        'https://github.com/some/repo/missing': '4df6be44e605e1123b3b98c27094b1515f518b8df3db7c77615f9c85e553a43a'
      })
      .expect(200)
      .expect({
        'https://github.com/some/repo/path': true,
        'https://github.com/some/repo/other': false,
        'https://github.com/some/repo/missing': false
      }, done);
  });
});
