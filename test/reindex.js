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

  // Sniff the indexEnvelope call.
  var indexed = null;
  var realIndexEnvelope = null;
  beforeEach(function () {
    indexed = {};
    realIndexEnvelope = storage._indexEnvelope;
    storage._indexEnvelope = function (contentID, envelope, indexName, callback) {
      indexed[contentID] = envelope;
      realIndexEnvelope(contentID, envelope, indexName, callback);
    };
  });
  afterEach(function () {
    storage._indexEnvelope = realIndexEnvelope;
  });

  it('requires an admin key', function (done) {
    authHelper.ensureAdminIsRequired(
      request(server.create()).post('/reindex'),
      done);
  });

  describe('with content', function () {
    beforeEach(function (done) {
      storage.storeEnvelope('idOne', { body: 'aaa bbb ccc' }, done);
    });
    beforeEach(function (done) {
      storage.storeEnvelope('idTwo', { body: 'ddd eee fff' }, done);
    });
    beforeEach(function (done) {
      storage.storeEnvelope('idThree', { body: 'ggg hhh iii' }, done);
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
