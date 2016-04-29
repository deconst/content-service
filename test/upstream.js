'use strict';
/* global describe it beforeEach afterEach */

/*
 * Unit tests for proxying failures to an upstream content service.
 */

const before = require('./helpers/before');

const chai = require('chai');
const dirtyChai = require('dirty-chai');
chai.use(dirtyChai);

const async = require('async');
const nock = require('nock');
const request = require('supertest');
const streamifier = require('streamifier');
const storage = require('../src/storage');
const server = require('../src/server');
const resetHelper = require('./helpers/reset');

describe('upstream', () => {
  beforeEach(resetHelper);
  beforeEach(before.configureWith({
    PROXY_UPSTREAM: 'https://upstream'
  }));

  describe('with content', () => {
    beforeEach((done) => storage.storeEnvelope('https://github.com/local/local', { body: 'local' }, done));
    beforeEach((done) => storage.storeEnvelope('https://github.com/local/badsha256', { body: 'badsha256' }, done));

    it('returns local content the same', (done) => {
      request(server.create())
        .get('/content/https%3A%2F%2Fgithub.com%2Flocal%2Flocal')
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', 'application/json')
        .expect({ envelope: { body: 'local' } }, done);
    });

    it('queries the upstream content service when content is not found locally', (done) => {
      nock('https://upstream')
        .get('/content/https%3A%2F%2Fgithub.com%2Fremote%2Fremote').reply(200, { envelope: { body: 'remote' } });

      request(server.create())
        .get('/content/https%3A%2F%2Fgithub.com%2Fremote%2Fremote')
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', 'application/json')
        .expect({ envelope: { body: 'remote' } }, done);
    });

    it('propagates lookup failures from the upstream content service', (done) => {
      nock('https://upstream')
        .get('/content/https%3A%2F%2Fgithub.com%2Fremote%2Fremote').reply(404);

      request(server.create())
        .get('/content/https%3A%2F%2Fgithub.com%2Fremote%2Fremote')
        .set('Accept', 'application/json')
        .expect(404, done);
    });

    it('reports non-404 failures from upstream as 502s', (done) => {
      nock('https://upstream')
        .get('/content/https%3A%2F%2Fgithub.com%2Fremote%2Fremote').reply(500, { message: 'wtf' });

      request(server.create())
        .get('/content/https%3A%2F%2Fgithub.com%2Fremote%2Fremote')
        .set('Accept', 'application/json')
        .expect(502, done);
    });

    it('merges /checkcontent results from upstream', (done) => {
      nock('https://upstream/')
        .get('/checkcontent', {
          'https://github.com/remote/remote': 'b1b6e4c544880769b42bdbf7f6338cba3db78cf734424af20e5c4d30251a984c',
          'https://github.com/remote/missing': '0ff459af6d050d72d642eeb3a1ea5a8a93fd518993ac56711bd86a7e49b95191'
        })
        .reply(200, {
          'https://github.com/remote/remote': true,
          'https://github.com/remote/missing': false
        });

      request(server.create())
        .get('/checkcontent')
        .send({
          'https://github.com/local/local': 'db850696925a0ff86c244680f64d0e53728a2dcda6dfc9aaa5492be3fd43e50f',
          'https://github.com/local/badsha256': 'e3a84f27f812f7a404b9428dd171483e95f2e21fa8c0fa98cae4ba1f7e8b8176',
          'https://github.com/remote/remote': 'b1b6e4c544880769b42bdbf7f6338cba3db78cf734424af20e5c4d30251a984c',
          'https://github.com/remote/missing': '0ff459af6d050d72d642eeb3a1ea5a8a93fd518993ac56711bd86a7e49b95191'
        })
        .expect(200)
        .expect({
          'https://github.com/local/local': true,
          'https://github.com/local/badsha256': false,
          'https://github.com/remote/remote': true,
          'https://github.com/remote/missing': false
        }, done);
    });

    describe('in staging mode', () => {
      beforeEach(before.configureWith({
        PROXY_UPSTREAM: 'https://upstream',
        STAGING_MODE: 'true'
      }));

      it('removes the first path segment from each proxied content ID', (done) => {
        nock('https://upstream')
          .get('/content/https%3A%2F%2Fgithub.com%2Ffoo%2Fbar%2Fremote').reply(200, {
            envelope: { body: 'remote' }
          });

        request(server.create())
          .get('/content/https%3A%2F%2Fgithub.com%2Fbuild-123456%2Ffoo%2Fbar%2Fremote')
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', 'application/json')
          .expect({ envelope: { body: 'remote' } }, done);
      });

      it('merges /checkcontent results from upstream with first path segments removed', (done) => {
        nock('https://upstream/')
          .get('/checkcontent', {
            'https://github.com/remote/remote': 'b1b6e4c544880769b42bdbf7f6338cba3db78cf734424af20e5c4d30251a984c',
            'https://github.com/remote/missing': '0ff459af6d050d72d642eeb3a1ea5a8a93fd518993ac56711bd86a7e49b95191'
          })
          .reply(200, {
            'https://github.com/remote/remote': true,
            'https://github.com/remote/missing': false
          });

        request(server.create())
          .get('/checkcontent')
          .send({
            'https://github.com/build-123456/remote/remote': 'b1b6e4c544880769b42bdbf7f6338cba3db78cf734424af20e5c4d30251a984c',
            'https://github.com/build-123456/remote/missing': '0ff459af6d050d72d642eeb3a1ea5a8a93fd518993ac56711bd86a7e49b95191'
          })
          .expect(200)
          .expect({
            'https://github.com/build-123456/remote/remote': true,
            'https://github.com/build-123456/remote/missing': false
          }, done);
      });

      it('supports /checkcontent queries for ambiguous upstream content', (done) => {
        nock('https://upstream/')
          .get('/checkcontent', {
            'https://github.com/remote/remote': 'b1b6e4c544880769b42bdbf7f6338cba3db78cf734424af20e5c4d30251a984c'
          })
          .reply(200, {
            'https://github.com/remote/remote': true
          })
          .get('/checkcontent', {
            'https://github.com/remote/remote': '0ff459af6d050d72d642eeb3a1ea5a8a93fd518993ac56711bd86a7e49b95191'
          })
          .reply(200, {
            'https://github.com/remote/remote': false
          });

        request(server.create())
          .get('/checkcontent')
          .send({
            'https://github.com/build-123456/remote/remote': 'b1b6e4c544880769b42bdbf7f6338cba3db78cf734424af20e5c4d30251a984c',
            'https://github.com/build-654321/remote/remote': '0ff459af6d050d72d642eeb3a1ea5a8a93fd518993ac56711bd86a7e49b95191'
          })
          .expect(200)
          .expect({
            'https://github.com/build-123456/remote/remote': true,
            'https://github.com/build-654321/remote/remote': false
          }, done);
      });
    });
  });

  describe('with assets', () => {
    beforeEach((done) => {
      // Note to self: this is still kind of awkward.
      let assets = [
        { name: 'only-local', filename: 'only-local-123123.jpg', type: 'image/jpg' },
        { name: 'both-right', filename: 'both-right-789789.jpg', type: 'image/jpg' },
        { name: 'both-wrong', filename: 'both-wrong-111111.jpg', type: 'image/jpg' },
        { filename: 'different-on-upstream-345345.jpg', type: 'image/jpg' }
      ];

      let storeEach = (asset, cb) => {
        const empty = streamifier.createReadStream(new Buffer(0));
        storage.storeAsset(empty, asset.filename, asset.type, (err, publicURL) => {
          if (err) return cb(err);

          if (asset.name) {
            storage.nameAsset(asset.name, publicURL, cb);
          } else {
            cb(null);
          }
        });
      };

      async.each(assets, storeEach, done);
    });

    it('merges assets from upstream and local, preferring local', (done) => {
      nock('https://upstream')
        .get('/assets').reply(200, {
          'only-upstream': 'https://assets.horse/up/only-upstream-123123.jpg',
          'both-right': 'https://assets.horse/up/both-789789.jpg',
          'both-wrong': 'https://assets.horse/up/both-wrong-111111.jpg'
        });

      request(server.create())
        .get('/assets')
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', 'application/json')
        .expect({
          'only-upstream': 'https://assets.horse/up/only-upstream-123123.jpg',
          'only-local': storage.assetPublicURL('only-local-123123.jpg'),
          'both-right': storage.assetPublicURL('both-right-789789.jpg'),
          'both-wrong': storage.assetPublicURL('both-wrong-111111.jpg')
        }, done);
    });

    it('prefers upstream assets in /checkassets calls', (done) => {
      nock('https://upstream')
        .get('/checkassets', {
          'somepath/only-local.jpg': '123123',
          'different-on-upstream.jpg': '345345',
          'otherpath/only-upstream.jpg': '456456',
          'more/paths/both-right.jpg': '789789',
          'both-wrong.jpg': '000000'
        }).reply(200, {
          'somepath/only-local.jpg': null,
          'different-on-upstream.jpg': null,
          'otherpath/only-upstream.jpg': 'https://assets.horse/up/only-upstream-456456.jpg',
          'more/paths/both-right.jpg': 'https://assets.horse/up/both-right-789789.jpg',
          'both-wrong.jpg': null
        });

      request(server.create())
        .get('/checkassets')
        .send({
          'somepath/only-local.jpg': '123123',
          'different-on-upstream.jpg': '345345',
          'otherpath/only-upstream.jpg': '456456',
          'more/paths/both-right.jpg': '789789',
          'both-wrong.jpg': '000000'
        })
        .expect(200)
        .expect({
          'somepath/only-local.jpg': storage.assetPublicURL('only-local-123123.jpg'),
          'different-on-upstream.jpg': storage.assetPublicURL('different-on-upstream-345345.jpg'),
          'otherpath/only-upstream.jpg': 'https://assets.horse/up/only-upstream-456456.jpg',
          'more/paths/both-right.jpg': 'https://assets.horse/up/both-right-789789.jpg',
          'both-wrong.jpg': null
        }, done);
    });
  });

  describe('control SHA', () => {
    it('proxies /control directly to upstream', (done) => {
      nock('https://upstream')
        .get('/control').reply(200, { sha: '12341234' });

      request(server.create())
        .get('/control')
        .set('Accept', 'application/json')
        .expect(200)
        .expect({ sha: '12341234' }, done);
    });
  });

  afterEach(before.reconfigure);
});
