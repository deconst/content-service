'use strict';
/* global describe it beforeEach afterEach */

/*
 * Unit tests for proxying failures to an upstream content service.
 */

const before = require('./helpers/before');

const chai = require('chai');
const dirtyChai = require('dirty-chai');
chai.use(dirtyChai);

const resetHelper = require('./helpers/reset');

describe('upstream', () => {
  beforeEach(resetHelper);
  beforeEach(before.configureWith({
    PROXY_UPSTREAM: 'upstream'
  }));

  it('returns present content the same');
  it('queries the upstream content service when content is not found locally');
  it('propagates failures from the upstream content service');

  afterEach(before.reconfigure);
});
