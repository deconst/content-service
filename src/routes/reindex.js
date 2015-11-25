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
  var state = {
    startedTs: Date.now(),
    elapsedMs: null,
    successfulEnvelopes: 0,
    failedEnvelopes: 0,
    totalEnvelopes: 0
  };

  log.info('Reindex requested', state);

  var handleError = function (err, message, fatal) {
    state.errMessage = err.message;
    state.stack = err.stack;

    log.error(message, state);

    if (fatal) {
      exports.completedCallback(err, state);
    }
  };

  storage.listContent(function (err, contentIDs, next) {
    if (err) return handleError(err, 'Unable to list content', true);

    if (contentIDs.length === 0) {
      // We've listed all of the content. Declare victory in the logs.
      state.elapsedMs = Date.now() - state.startedTs;
      log.info('All content re-indexed.', state);

      exports.completedCallback(null, state);
      return;
    }

    var reindexContentID = function (contentID, cb) {
      storage.getContent(contentID, function (err, envelope) {
        if (err) {
          handleError(err, 'Unable to fetch envelope with ID [' + contentID + ']', false);

          state.failedEnvelopes++;
          state.totalEnvelopes++;
          return cb();
        }

        log.debug('Successful envelope fetch', {
          contentID: contentID
        });

        storage.indexContent(contentID, envelope, function (err) {
          if (err) {
            handleError(err, 'Unable to index envelope with ID [' + contentID + ']', false);
            state.failedEnvelopes++;
            state.totalEnvelopes++;
            return cb();
          }

          log.debug('Successful envelope index', {
            contentID: contentID
          });

          state.successfulEnvelopes++;
          state.totalEnvelopes++;
          cb();
        });
      });
    };

    async.mapLimit(contentIDs, 20, reindexContentID, next);
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
