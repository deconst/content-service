'use strict';
/* global describe it beforeEach afterEach */

/*
 * Unit tests for proxying failures to an upstream content service.
 */

const before = require('./helpers/before');

const chai = require('chai');
const dirtyChai = require('dirty-chai');
chai.use(dirtyChai);

const request = require('supertest');
const storage = require('../src/storage');
const server = require('../src/server');
const resetHelper = require('./helpers/reset');

describe('upstream', () => {
  beforeEach(resetHelper);
  beforeEach(before.configureWith({
    PROXY_UPSTREAM: 'upstream'
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

  it('queries the upstream content service when content is not found locally');
  it('propagates failures from the upstream content service');

  afterEach(before.reconfigure);
});
