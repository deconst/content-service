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
const storage = require('../src/storage');
const server = require('../src/server');
const resetHelper = require('./helpers/reset');

describe('upstream', () => {
  beforeEach(resetHelper);
  beforeEach(before.configureWith({
    PROXY_UPSTREAM: 'https://upstream'
  }));

  // Prepopulate local storage with content and two assets.
  beforeEach((done) => storage.storeContent('local', { body: 'local' }, done));
  beforeEach((done) => {
    // Note to self: this is extremely awkward.
    let assets = [
      {
        key: 'only-local',
        original: 'only-local.jpg',
        filename: 'only-local-123123.jpg',
        chunks: [],
        type: 'image/jpg'
      },
      {
        key: 'both',
        original: 'both.jpg',
        filename: 'both-456456.jpg',
        chunks: [],
        type: 'image/jpg'
      }
    ];

    let storeEach = (asset, cb) => {
      storage.storeAsset(asset, (err) => {
        if (err) return cb(err);

        storage.nameAsset(asset, cb);
      });
    };

    async.each(assets, storeEach, done);
  });

  it('returns local content the same', (done) => {
    nock('https://upstream')
      .get('/assets').reply(200, {});

    request(server.create())
      .get('/content/local')
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', 'application/json')
      .expect({
        assets: {
          'only-local': '/__local_asset__/only-local-123123.jpg',
          'both': '/__local_asset__/both-456456.jpg'
        },
        envelope: { body: 'local' }
      }, done);
  });

  it('returns assets merged from local and upstream', (done) => {
    nock('https://upstream')
      .get('/assets').reply(200, {
        'only-upstream': 'https://assets.horse/up/only-upstream-123123.jpg',
        'both': 'https://assets.horse/up/both-321321.jpg'
      });

    request(server.create())
      .get('/content/local')
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', 'application/json')
      .expect({
        assets: {
          'only-upstream': 'https://assets.horse/up/only-upstream-123123.jpg',
          'only-local': '/__local_asset__/only-local-123123.jpg',
          'both': '/__local_asset__/both-456456.jpg'
        },
        envelope: { body: 'local' }
      }, done);
  });

  it('queries the upstream content service when content is not found locally', (done) => {
    nock('https://upstream')
      .get('/content/remote').reply(200, {
        assets: {
          'only-upstream': 'https://assets.horse/up/only-upstream-123123.jpg',
          'both': 'https://assets.horse/up/both-321321.jpg'
        },
        envelope: { body: 'remote' }
      });

    request(server.create())
      .get('/content/remote')
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', 'application/json')
      .expect({
        assets: {
          'only-upstream': 'https://assets.horse/up/only-upstream-123123.jpg',
          'only-local': '/__local_asset__/only-local-123123.jpg',
          'both': '/__local_asset__/both-456456.jpg'
        },
        envelope: { body: 'remote' }
      }, done);
  });

  it('propagates lookup failures from the upstream content service', (done) => {
    nock('https://upstream')
      .get('/content/remote').reply(404);

    request(server.create())
      .get('/content/remote')
      .set('Accept', 'application/json')
      .expect(404, done);
  });

  it('reports non-404 failures from upstream as 502s', (done) => {
    nock('https://upstream')
      .get('/content/remote').reply(500, { message: 'wtf' });

    request(server.create())
      .get('/content/remote')
      .set('Accept', 'application/json')
      .expect(502, done);
  });

  describe('in staging mode', () => {
    beforeEach(before.configureWith({
      PROXY_UPSTREAM: 'https://upstream',
      STAGING_MODE: 'true'
    }));

    it('removes the first path segment from each proxied content ID', (done) => {
      nock('https://upstream')
        .get('/content/https%3A%2F%2Fgithub.com%2Ffoo%2Fbar%2Fremote').reply(200, {
          assets: { one: 'https://assets.horse/one-321321.jpg' },
          envelope: { body: 'remote' }
        });

      request(server.create())
        .get('/content/https%3A%2F%2Fgithub.com%2Fbuild-123456%2Ffoo%2Fbar%2Fremote')
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', 'application/json')
        .expect({
          assets: {
            one: 'https://assets.horse/one-321321.jpg',
            'only-local': '/__local_asset__/only-local-123123.jpg',
            'both': '/__local_asset__/both-456456.jpg'
          },
          envelope: { body: 'remote' }
        }, done);
    });

    it('merges assets from upstream and local, preferring local');
  });

  afterEach(before.reconfigure);
});
