/* global describe it beforeEach */

/*
 * Unit tests for the /asset endpoint.
 */

require('./helpers/before');

var chai = require('chai');
var dirtyChai = require('dirty-chai');

chai.use(dirtyChai);

var async = require('async');
var request = require('supertest');
var resetHelper = require('./helpers/reset');
var authHelper = require('./helpers/auth');
var storage = require('../src/storage');
var server = require('../src/server');

describe('/assets', function () {
  beforeEach(resetHelper);

  it('accepts an asset file and produces a fingerprinted filename', function (done) {
    // shasum -a 256 test/fixtures/asset-file.txt
    var finalName = storage.assetURLPrefix() +
      'asset-file-0a1b4ceeaee9f0b7325a5dbdb93497e1f8c98d03b6f2518084294faa3452efc1.txt';

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
    var finalName = storage.assetURLPrefix() +
      'asset-file-0a1b4ceeaee9f0b7325a5dbdb93497e1f8c98d03b6f2518084294faa3452efc1.txt';

    var app = server.create();

    request(app)
      .post('/assets')
      .query({
        named: 'true'
      })
      .set('Authorization', authHelper.AUTH_USER)
      .attach('first', 'test/fixtures/asset-file.txt')
      .end(function (err, res) {
        if (err) throw err;

        request(app)
          .get('/assets')
          .expect(200)
          .expect('Content-Type', /json/)
          .expect('{"first":"' + finalName + '"}', done);
      });
  });

});
