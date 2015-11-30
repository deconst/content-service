/* global describe it beforeEach */

require('./helpers/before');

var request = require('supertest');
var resetHelper = require('./helpers/reset');
var storage = require('../src/storage');
var server = require('../src/server');

describe('/search', function () {
  beforeEach(resetHelper);

  beforeEach(function (done) {
    storage.storeContent('foo/aaa', '{ "body": "all aaa" }', done);
  });
  beforeEach(function (done) {
    storage.storeContent('foo/bbb', '{ "body": "all bbb" }', done);
  });
  beforeEach(function (done) {
    storage.storeContent('foo/ccc', '{ "body": "all ccc" }', done);
  });

  it('returns IDs of matching documents', function (done) {
    request(server.create())
      .get('/search?q=all')
      .expect(200)
      .expect({
        results: [
          { contentID: 'foo/aaa' },
          { contentID: 'foo/bbb' },
          { contentID: 'foo/ccc' }
        ]
      }, done);
  });
});
