'use strict';
/* global describe it beforeEach afterEach */

/*
 * Unit tests for proxying failures to an upstream content service.
 */

const before = require('./helpers/before');

const chai = require('chai');
const dirtyChai = require('dirty-chai');
chai.use(dirtyChai);

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

  // Prepopulate local storage with content.
  beforeEach((done) => storage.storeContent('local', { body: 'local' }, done));

  it('returns local content the same', (done) => {
    request(server.create())
      .get('/content/local')
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', 'application/json')
      .expect({ assets: {}, envelope: { body: 'local' } }, done);
  });

  it('returns assets merged from local and upstream');

  it('queries the upstream content service when content is not found locally', (done) => {
    nock('https://upstream')
      .get('/content/remote').reply(200, { assets: {}, envelope: { body: 'remote' } });

    request(server.create())
      .get('/content/remote')
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', 'application/json')
      .expect({ assets: {}, envelope: { body: 'remote' } }, done);
  });

  it('propagates lookup failures from the upstream content service', (done) => {
    nock('https://upstream')
      .get('/content/remote').reply(404);

    request(server.create())
      .get('/content/remote')
      .set('Accept', 'application/json')
      .expect(404, done);
  });

  it('reports non-404 failures from upstream as 502s');

  afterEach(before.reconfigure);
});
