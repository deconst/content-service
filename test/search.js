/* global describe it beforeEach */

require('./helpers/before');

var request = require('supertest');
var resetHelper = require('./helpers/reset');
var storage = require('../src/storage');
var server = require('../src/server');

describe('/search', function () {
  beforeEach(resetHelper);

  beforeEach(function (done) {
    storage.indexContent('foo/aaa', { title: undefined, body: 'all aaa', keywords: '' }, done);
  });
  beforeEach(function (done) {
    storage.indexContent('foo/bbb', { title: undefined, body: 'all bbb', keywords: '' }, done);
  });
  beforeEach(function (done) {
    storage.indexContent('foo/ccc', { title: undefined, body: 'all ccc', keywords: '' }, done);
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
