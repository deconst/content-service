var async = require('async');

var config = require('../../src/config');
var storage = require('../../src/storage');
var connection = require('../../src/storage/connection');
var auth = require('./auth');

function clearCollection (name, callback) {
  var collection = connection.db.collection(name);
  collection.count({}, function (err, count) {
    if (err) return callback(err);

    if (count > 0) {
      collection.drop(callback);
    } else {
      callback();
    }
  });
}

function setupStorage (callback) {
  storage.setup(callback);
}

function clearStorage (callback) {
  storage.clear(callback);
}

function clearAPIKeys (callback) {
  clearCollection('apiKeys', callback);
}

function installAPIKey (callback) {
  storage.storeKey({ name: 'user', apikey: auth.APIKEY_USER }, callback);
}

function clearNamedAssets (callback) {
  clearCollection('layoutAssets', callback);
}

/**
 * @description If running in INTEGRATION mode with live, remote storage:
 *  * Clear API keys and install the expected fixture API key
 *  * Clear named assets
 */
module.exports = function (callback) {
  var steps = [setupStorage];

  if (config.storage() === 'remote') {
    steps.push(clearAPIKeys);
    steps.push(installAPIKey);
    steps.push(clearNamedAssets);
  } else {
    steps.push(clearStorage);
    steps.push(installAPIKey);
  }

  async.series(steps, callback);
};
