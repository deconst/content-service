'use strict';

// Reindex submitted content from its canonical source.

var async = require('async');
var storage = require('../storage');
var log = require('../logging').getLogger();

/**
 * @description Callback to fire when reindexing is complete.
 */
exports.completedCallback = function () {};

/**
 * @description Enumerate all known content from the active storage implementation. Re-index each
 *  envelope against the storage. Log progress and record it in a state variable. When complete,
 *  invoke the completedCallback with the accumulated state.
 */
function reindex () {
  let indexName = `envelopes_${Date.now()}`;

  let state = {
    event: 'reindex',
    indexName: indexName,
    startedTs: Date.now(),
    elapsedMs: null,
    successfulEnvelopes: 0,
    failedEnvelopes: 0,
    totalEnvelopes: 0
  };

  log.info('Reindex requested', state);

  let handleError = function (err, message, fatal) {
    state.errMessage = err.message;
    state.stack = err.stack;

    log.error(message, state);

    if (fatal) {
      exports.completedCallback(err, state);
    }
  };

  let createIndex = function (callback) {
    storage.createNewIndex(indexName, (err) => {
      if (err) return handleError(err, 'Unable to create new index', true);

      callback();
    });
  };

  let reindexAllContent = function (callback) {
    storage.listEnvelopes(null, (err, doc) => {
      state.totalEnvelopes++;

      if (err) {
        state.failedEnvelopes++;
        return handleError(err, 'Unable to list content', true);
      }

      log.debug('Reindexing envelope', { event: 'reindex', contentID: doc.contentID });

      storage.indexEnvelope(doc.contentID, doc.envelope, indexName, (err) => {
        if (err) {
          handleError(err, `Unable to index envelope with ID [${doc.contentID}]`, false);
          state.failedEnvelopes++;
          return;
        }

        log.debug('Successful envelope index', { event: 'reindex', contentID: doc.contentID });

        state.successfulEnvelopes++;
      });
    }, (err) => {
      // All envelopes listed.
      if (err) return handleError(err, 'Unable to list envelopes', true);

      log.info('All content re-indexed.', state);
      callback();
    });
  };

  let makeIndexActive = function (callback) {
    storage.makeIndexActive(indexName, (err) => {
      if (err) return handleError(err, 'Unable to make the index active', true);

      callback(null);
    });
  };

  async.series([
    createIndex,
    reindexAllContent,
    makeIndexActive
  ], (err) => {
    if (err) return handleError(err, 'Top-level error', true);

    state.elapsedMs = Date.now() - state.startedTs;
    exports.completedCallback(null, state);
  });
}

/**
 * @description Trigger an asynchronous reindexing of all content.
 */
exports.begin = function (req, res, next) {
  reindex();

  res.send(202);
  next();
};
