'use strict';
/* global describe it beforeEach */

/*
 * Unit tests for the /asset endpoint.
 */

require('./helpers/before');

const chai = require('chai');
const dirtyChai = require('dirty-chai');
chai.use(dirtyChai);

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const async = require('async');
const request = require('supertest');
const tarfs = require('tar-fs');
const getRawBody = require('raw-body');
const streamifier = require('streamifier');
const resetHelper = require('./helpers/reset');
const authHelper = require('./helpers/auth');
const storage = require('../src/storage');
const server = require('../src/server');

describe('/assets', function () {
  // shasum -a 256 test/fixtures/asset-file.txt
  var fingerprintedFilename =
  'asset-file-0a1b4ceeaee9f0b7325a5dbdb93497e1f8c98d03b6f2518084294faa3452efc1.txt';
  var finalName;

  beforeEach(resetHelper);
  beforeEach(function () {
    finalName = storage.assetURLPrefix() + fingerprintedFilename;
  });

  it('accepts an asset file and produces a fingerprinted filename', function (done) {
    request(server.create())
      .post('/assets')
      .set('Authorization', authHelper.AUTH_USER)
      .attach('first', 'test/fixtures/asset-file.txt')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect({
        'asset-file.txt': finalName
      }, done);
  });

  it('requires authentication', function (done) {
    authHelper.ensureAuthIsRequired(
      request(server.create())
        .post('/assets')
        .attach('first', 'test/fixtures/asset-file.txt'),
      done);
  });

  it('lists fingerprinted assets', function (done) {
    var app = server.create();

    request(app)
      .post('/assets')
      .query({ named: 'true' })
      .set('Authorization', authHelper.AUTH_USER)
      .attach('first', 'test/fixtures/asset-file.txt')
      .end(function (err, res) {
        if (err) throw err;

        request(app)
          .get('/assets')
          .expect(200)
          .expect('Content-Type', /json/)
          .expect({ first: finalName }, done);
      });
  });

  it('retrieves assets by fingerprinted filename', function (done) {
    var app = server.create();
    var rawAssetContents = fs.readFileSync('test/fixtures/asset-file.txt').toString();

    request(app)
      .post('/assets')
      .set('Authorization', authHelper.AUTH_USER)
      .attach('first', 'test/fixtures/asset-file.txt')
      .end(function (err) {
        if (err) throw err;

        request(app)
          .get('/assets/' + fingerprintedFilename)
          .expect(200)
          .expect('Content-Type', 'text/plain')
          .expect(rawAssetContents, done);
      });
  });

  it("doesn't crash with a trailing slash", function (done) {
    request(server.create())
      .get('/assets/')
      .expect(200, done);
  });
});

describe('/bulkasset', function () {
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

  const expectStoredAsset = function (filename) {
    return (cb) => storage.getAsset(filename, cb);
  };

  it('uploads all assets from a tarball', function (done) {
    async.series([
      withFixtureTarball('assets', (tarball, cb) => {
        let r = request(server.create())
          .post('/bulkasset')
          .set('Authorization', authHelper.AUTH_USER)
          .set('Content-Type', 'application/tar+gzip');

        r.write(tarball);

        r.expect(200).end(cb);
      }),
      expectStoredAsset('style-260fccfc8f2a9f455bc7593b6aa9f97b9c59115450c52ea6d44b3833a1e9e158.css'),
      expectStoredAsset('script-650a4020d200ba58e1cb4d32af8e84bc0ae3c10f610305e955db14841b191ab3.js'),
      expectStoredAsset('dc-logo-0ec14d405ea0304b826fd8dc9de17638ed78cecec65b73d2b5847687da3c8e1f.png')
    ], done);
  });
});

describe('/checkassets', function () {
  beforeEach(resetHelper);

  beforeEach(function (done) {
    const stream = streamifier.createReadStream('fake asset');
    storage.storeAsset(stream, 'fake-asset-1234.txt', 'text/plain', done);
  });

  beforeEach(function (done) {
    const stream = streamifier.createReadStream('another');
    storage.storeAsset(stream, 'This%20file%20is%20url-encoded-9999.txt', 'text/plain', done);
  });

  it("returns the publicURL for each asset that exists and null for those that don't", function (done) {
    const finalName = storage.assetURLPrefix() + 'fake-asset-1234.txt';

    request(server.create())
      .get('/checkassets')
      .send({ 'path/fake-asset.txt': '1234', 'other/missing-asset.jpg': '4321' })
      .expect(200)
      .expect({ 'path/fake-asset.txt': finalName, 'other/missing-asset.jpg': null }, done);
  });

  it('verifies the correct filename for assets that with URL-encoded names', function (done) {
    const finalName = storage.assetURLPrefix() + 'This%2520file%2520is%2520url-encoded-9999.txt';

    request(server.create())
      .get('/checkassets')
      .send({ 'path/This%20file%20is%20url-encoded.txt': '9999' })
      .expect(200)
      .expect({ 'path/This%20file%20is%20url-encoded.txt': finalName }, done);
  });
});
