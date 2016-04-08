/**
 * Interfaces between the API and the underlying storage engines.
 */

var cheerio = require('cheerio');
var config = require('../config');
var memory = require('./memory');
var remote = require('./remote');
var logger = require('../logging').getLogger();

// Methods to delegate to the activated storage driver.
var delegates = exports.delegates = [
  'clear',
  'assetURLPrefix',
  'storeAsset',
  'bulkStoreAssets',
  'nameAsset',
  'findNamedAssets',
  'getAsset',
  'storeKey',
  'deleteKey',
  'findKeys',
  '_storeEnvelope',
  '_getEnvelope',
  'deleteEnvelope',
  'bulkDeleteEnvelopes',
  'listEnvelopes',
  'createNewIndex',
  '_indexEnvelope',
  'makeIndexActive',
  'queryEnvelopes',
  'unindexEnvelope',
  'bulkUnindexEnvelopes',
  'storeSHA',
  'getSHA'
];

/**
 * @description Create a function that will throw an error if a delegating function is called before
 * setup() is invoked.
 */
function makeNotSetupFunction (fname) {
  return function () {
    throw new Error('Attempt to call ' + fname + ' before storage.setup() is invoked.');
  };
}

for (var i = 0; i < delegates.length; i++) {
  exports[delegates[i]] = makeNotSetupFunction(delegates[i]);
}

/**
 * @description Instantiate the configured storage driver and invoke its setup method.
 */
exports.setup = function (callback) {
  var driverName = config.storage();
  var driver = null;

  if (driverName === 'remote') {
    driver = new remote.RemoteStorage();
    exports.remote = driver;
    logger.debug('Remote storage driver active.');
  } else if (driverName === 'memory') {
    driver = new memory.MemoryStorage();
    exports.memory = driver;
    logger.debug('In-memory storage driver active.');
  } else {
    return callback(new Error('Invalid driver name: ' + driverName));
  }

  driver.setup(function (err) {
    if (err) return callback(err);

    for (var i = 0; i < delegates.length; i++) {
      var delegateName = delegates[i];

      if (driver[delegateName]) {
        exports[delegateName] = driver[delegateName].bind(driver);
      }
    }

    callback(null);
  });
};

// Facade functions to perform common input preprocessing.

exports.storeEnvelope = function (contentID, envelope, callback) {
  const doc = {
    contentID,
    envelope,
    lastUpdated: Date.now()
  };

  exports._storeEnvelope(contentID, doc, callback);
};

exports.getEnvelope = function (contentID, callback) {
  exports._getEnvelope(contentID, function (err, doc) {
    if (err) return callback(err);
    callback(null, doc ? doc.envelope : null);
  });
};

exports.indexEnvelope = function (contentID, envelope, indexName, callback) {
  // indexName is optional and defaults to the alias "envelopes_current".
  if (!callback) {
    callback = indexName;
    indexName = 'envelopes_current';
  }

  // Skip envelopes that have "unsearchable" set to true.
  if (envelope.unsearchable) {
    return callback(null);
  }

  var kws = envelope.keywords || [];
  var $ = cheerio.load(envelope.body || '', {
    normalizeWhitespace: true
  });

  var subset = {
    title: envelope.title || '',
    body: $.root().text(),
    keywords: kws.join(' '),
    categories: envelope.categories || []
  };

  exports._indexEnvelope(contentID, subset, indexName, callback);
};
