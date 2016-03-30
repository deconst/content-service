/* global describe it beforeEach */

require('./helpers/before');

var request = require('supertest');
var resetHelper = require('./helpers/reset');
var storage = require('../src/storage');
var server = require('../src/server');

describe('/search', function () {
  beforeEach(resetHelper);

  beforeEach(function (done) {
    storage.indexContent('foo/aaa', { title: 'first', body: 'all aaa', keywords: '' }, done);
  });
  beforeEach(function (done) {
    storage.indexContent('foo/bbb', { title: 'second', body: 'all bbb', keywords: '' }, done);
  });
  beforeEach(function (done) {
    storage.indexContent('foo/ccc', { title: 'third', body: 'all ccc', keywords: '' }, done);
  });

  it('returns IDs of matching documents', function (done) {
    request(server.create())
      .get('/search?q=all')
      .expect(200)
      .expect({
        total: 3,
        results: [
          {
            contentID: 'foo/aaa',
            title: 'first',
            excerpt: '...<em>all</em>...'
          },
          {
            contentID: 'foo/bbb',
            title: 'second',
            excerpt: '...<em>all</em>...'
          },
          {
            contentID: 'foo/ccc',
            title: 'third',
            excerpt: '...<em>all</em>...'
          }
        ]
      }, done);
  });

  it('returns a body excerpt when a match is only in the title', function (done) {
    request(server.create())
      .get('/search?q=second')
      .expect(200)
      .expect({
        total: 1,
        results: [
          {
            contentID: 'foo/bbb',
            title: 'second',
            excerpt: 'all bbb'
          }
        ]
      }, done);
  });

  it('responds with a 409 if no query is provided', function (done) {
    request(server.create())
      .get('/search')
      .expect(409, done);
  });
});
