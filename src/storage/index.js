/**
 * Interfaces between the API and the underlying storage engines.
 */

var config = require('../config');
var memory = require('./memory');
var remote = require('./remote');
var logger = require('../logging').getLogger();

// Methods to delegate to the activated storage driver.
var delegates = [
  'storeAsset',
  'nameAsset',
  'findNamedAssets',
  'storeKey',
  'deleteKey',
  'findKeys',
  'storeContent',
  'getContent',
  'deleteContent',
  'clear'
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

    var missing = [];
    for (var i = 0; i < delegates.length; i++) {
      var delegateName = delegates[i];

      if (!driver[delegateName]) {
        missing.push(delegateName);
      } else {
        exports[delegateName] = driver[delegateName].bind(driver);
      }
    }

    if (missing.length !== 0) {
      console.error('The following methods are missing from the ' + driverName + ' driver:');
      console.error(missing.join(', '));
      return callback(new Error('Driver missing methods: ' + driverName));
    }

    callback(null);
  });
};
