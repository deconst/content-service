/* global describe it */

/*
 * Ensure that storage providers are complete and consistent.
 */

 var chai = require('chai');
 var dirtyChai = require('dirty-chai');

 chai.use(dirtyChai);
 var expect = chai.expect;

var delegates = require('../src/storage').delegates;
var MemoryStorage = require('../src/storage/memory').MemoryStorage;
var RemoteStorage = require('../src/storage/remote').RemoteStorage;

var arities = {};

function ensureComplete (backend) {
  return function () {
    var instance = new backend();

    var makeDelegateTester = function (delegate) {
      return function () {
        expect(instance[delegate]).to.be.an.instanceOf(Function);

        if (arities[delegate] !== undefined) {
          expect(instance[delegate].length).to.equal(arities[delegate]);
        } else {
          arities[delegate] = instance[delegate].length;
        }
      };
    };

    delegates.forEach(function (delegate) {
      it("implements the " + delegate + " method", makeDelegateTester(delegate));
    });
  };
}

describe('the Memory storage backend', ensureComplete(MemoryStorage));
describe('the Remote storage backend', ensureComplete(RemoteStorage));
