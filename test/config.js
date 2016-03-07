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

const _ = require('lodash');
const before = require('./helpers/before');
const config = require('../src/config');

describe('config', () => {
  const minimum = {
    STORAGE: 'memory',
    ADMIN_APIKEY: '12345'
  };

  it('accepts the minimim configuration', () => {
    config.configure(minimum);

    expect(config.storage()).to.equal('memory');
    expect(config.adminAPIKey()).to.equal('12345');

    expect(config.rackspaceUsername()).to.be.undefined();
    expect(config.rackspaceAPIKey()).to.be.undefined();
    expect(config.rackspaceRegion()).to.be.undefined();
    expect(config.contentContainer()).to.be.undefined();
    expect(config.assetContainer()).to.be.undefined();
    expect(config.mongodbURL()).to.be.undefined();

    expect(config.rackspaceServiceNet()).to.be.false();
    expect(config.elasticsearchHost()).to.be.null();
    expect(config.contentLogLevel()).to.equal('info');
    expect(config.contentLogColor()).to.be.false();
    expect(config.proxyUpstream()).to.be.null();
    expect(config.stagingMode()).to.be.false();
    expect(config.mongodbPrefix()).to.equal('');
  });

  it('sets variables from the environment', () => {
    config.configure(_.defaults({
      STORAGE: 'memory',
      RACKSPACE_USERNAME: 'me',
      RACKSPACE_APIKEY: '12345',
      RACKSPACE_REGION: 'space',
      RACKSPACE_SERVICENET: 'true',
      ADMIN_APIKEY: '12345',
      CONTENT_CONTAINER: 'the-content-container',
      ASSET_CONTAINER: 'the-asset-container',
      MONGODB_URL: 'mongodb-url',
      MONGODB_PREFIX: 'foo-',
      ELASTICSEARCH_HOST: 'https://elasticsearch:9200/',
      CONTENT_LOG_LEVEL: 'debug',
      PROXY_UPSTREAM: 'https://upstream.horse:9000/',
      STAGING_MODE: 'true'
    }, minimum));

    expect(config.storage()).to.equal('memory');
    expect(config.rackspaceUsername()).to.equal('me');
    expect(config.rackspaceAPIKey()).to.equal('12345');
    expect(config.rackspaceRegion()).to.equal('space');
    expect(config.rackspaceServiceNet()).to.be.true();
    expect(config.adminAPIKey()).to.equal('12345');
    expect(config.contentContainer()).to.equal('the-content-container');
    expect(config.assetContainer()).to.equal('the-asset-container');
    expect(config.mongodbURL()).to.equal('mongodb-url');
    expect(config.mongodbPrefix()).to.equal('foo-');
    expect(config.elasticsearchHost()).to.equal('https://elasticsearch:9200/');
    expect(config.contentLogLevel()).to.equal('debug');
    expect(config.proxyUpstream()).to.equal('https://upstream.horse:9000/');
    expect(config.stagingMode()).to.equal(true);
  });

  it('requires PROXY_UPSTREAM when STAGING_MODE is active', () => {
    expect(() => {
      config.configure(_.defaults({
        STAGING_MODE: 'true'
      }, minimum));
    }).to.throw(Error);
  });

  afterEach(before.reconfigure);
});
