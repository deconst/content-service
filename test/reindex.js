/* global describe it beforeEach */

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

describe('/reindex', function () {
  beforeEach(resetHelper);

  it('requires an admin key', function (done) {
    authHelper.ensureAdminIsRequired(
      request(server.create()).post('/reindex'),
      done);
  });
});
