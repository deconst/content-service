'use strict';
/* global describe it afterEach */

/*
 * Tests for the environment variable configuration.
 */

require('./helpers/before');

const chai = require('chai');
const dirtyChai = require('dirty-chai');
chai.use(dirtyChai);
const expect = chai.expect;

const before = require('./helpers/before');
const config = require('../src/config');

describe('config', () => {
  it('sets variables from the environment', () => {
    config.configure({
      STORAGE: 'memory',
      RACKSPACE_USERNAME: 'me',
      RACKSPACE_APIKEY: '12345',
      RACKSPACE_REGION: 'space',
      RACKSPACE_SERVICENET: 'true',
      ADMIN_APIKEY: '12345',
      CONTENT_CONTAINER: 'the-content-container',
      ASSET_CONTAINER: 'the-asset-container',
      MONGODB_URL: 'mongodb-url',
      CONTENT_LOG_LEVEL: 'debug',
      PROXY_UPSTREAM: 'https://upstream.horse:9000/',
      STAGING_MODE: 'true'
    });

    expect(config.storage()).to.equal('memory');
    expect(config.rackspaceUsername()).to.equal('me');
    expect(config.rackspaceAPIKey()).to.equal('12345');
    expect(config.rackspaceRegion()).to.equal('space');
    expect(config.rackspaceServiceNet()).to.be.true();
    expect(config.adminAPIKey()).to.equal('12345');
    expect(config.contentContainer()).to.equal('the-content-container');
    expect(config.assetContainer()).to.equal('the-asset-container');
    expect(config.mongodbURL()).to.equal('mongodb-url');
    expect(config.contentLogLevel()).to.equal('debug');
    expect(config.proxyUpstream()).to.equal('https://upstream.horse:9000/');
    expect(config.stagingMode()).to.equal(true);
  });

  afterEach(before.reconfigure);
});
