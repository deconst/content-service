/* global describe it beforeEach afterEach */

/*
 * Unit tests for the content service.
 */

require('./helpers/before');

var chai = require('chai');
var dirtyChai = require('dirty-chai');

chai.use(dirtyChai);
var expect = chai.expect;

var request = require('supertest');
var authHelper = require('./helpers/auth');
var resetHelper = require('./helpers/reset');
var server = require('../src/server');
var storage = require('../src/storage');
var reindex = require('../src/routes/reindex');

describe('/reindex', function () {
  beforeEach(resetHelper);

  // Sniff the indexContent call.
  var indexed = null;
  var realIndexContent = null;
  beforeEach(function () {
    indexed = {};
    realIndexContent = storage._indexContent;
    storage._indexContent = function (contentID, envelope, callback) {
      indexed[contentID] = envelope;
      realIndexContent(contentID, envelope, callback);
    };
  });
  afterEach(function () {
    storage._indexContent = realIndexContent;
  });

  it('requires an admin key', function (done) {
    authHelper.ensureAdminIsRequired(
      request(server.create()).post('/reindex'),
      done);
  });

  describe('with content', function () {
    beforeEach(function (done) {
      storage.storeContent('idOne', { body: 'aaa bbb ccc' }, done);
    });
    beforeEach(function (done) {
      storage.storeContent('idTwo', { body: 'ddd eee fff' }, done);
    });
    beforeEach(function (done) {
      storage.storeContent('idThree', { body: 'ggg hhh iii' }, done);
    });

    it('reindexes all known content', function (done) {
      reindex.completedCallback = function (err, state) {
        expect(err).to.be.null();

        expect(indexed.idOne).to.deep.equal({ title: '', body: 'aaa bbb ccc', keywords: '', categories: [] });
        expect(indexed.idTwo).to.deep.equal({ title: '', body: 'ddd eee fff', keywords: '', categories: [] });
        expect(indexed.idThree).to.deep.equal({ title: '', body: 'ggg hhh iii', keywords: '', categories: [] });

        expect(state.totalEnvelopes).to.equal(3);
        expect(state.elapsedMs).not.to.be.undefined();

        done();
      };

      request(server.create())
        .post('/reindex')
        .set('Authorization', authHelper.AUTH_ADMIN)
        .expect(202, function (err) {
          if (err) done(err);
        });
    });
  });
});
