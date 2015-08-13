/* global describe it */

/*
 * Tests for the environment variable configuration.
 */

require('./helpers/before');

var chai = require('chai');
var dirtyChai = require('dirty-chai');

chai.use(dirtyChai);
var expect = chai.expect;

var before = require('./helpers/before');
var config = require('../src/config');

describe('config', function () {
  it('sets variables from the environment', function () {
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
      CONTENT_LOG_LEVEL: 'debug'
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
  });

  afterEach(before.reconfigure);
});
