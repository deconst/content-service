// Manage a connection to the Rackspace cloud. Retain and export handles to created resources.

var
  async = require('async'),
  pkgcloud = require('pkgcloud'),
  mongo = require('mongodb'),
  config = require('./config'),
  log = require('./logging').getLogger();

/**
 * @description Create a function that asynchronously creates a Rackspace container if it
 *   doesn't already exist.
 */
function makeContainerCreator(client, containerName, logicalName, cdn) {
  return function (callback) {
    var reportBack = function (err, container) {
      if (err) return callback(err);

      exports[logicalName] = container;

      log.debug("Container [" + container.name + "] now exists.");

      callback(null, container);
    };

    var cdnEnable = function (err, container) {
      if (err) return callback(err);

      log.debug("Enabling CDN on container [" + container.name + "].");

      client.setCdnEnabled(container, { ttl: 31536000, enabled: true }, reportBack);
    };

    var handleCreation = cdn ? cdnEnable : reportBack;

    log.info("Ensuring that container [" + containerName + "] exists.");

    // Instead of checking if the container exists first, we try to create it, and
    // if it already exists, we get a no-op (202) and move on.
    client.createContainer({ name: containerName }, handleCreation);
  };
}

/**
 * @description Utility function to ensure that the exported Container model includes CDN URIs when
 *   it's supposed to.
 */
function refresh(client, containerName, logicalName, callback) {
  client.getContainer(containerName, function (err, container) {
    if (err) {
      callback(err);
      return;
    }

    exports[logicalName] = container;

    callback(null);
  });
}

/**
 * @description Authenticate to MongoDB, export the active MongoDB connection as "db", and
 *   perform any necessary one-time initialization.
 */
function mongoInit(callback) {
  mongo.MongoClient.connect(config.mongodbURL(), function (err, db) {
    if (err) return callback(err);

    log.debug("Connected to MongoDB database at [" + config.mongodbURL() + "].");

    exports.db = db;

    var envelopes = db.collection("envelopes");

    // Create indices on collections as necessary.
    async.parallel([
      function (callback) { envelopes.createIndex("tags", { sparse: true }, callback); },
      function (callback) { envelopes.createIndex("categories", { sparse: true }, callback); },
      function (callback) { envelopes.createIndex("contentID", { unique: true }, callback); }
    ], function (err, db) {
      if (err) return callback(err);

      log.debug("All indices created.");

      callback(null);
    });
  });
}

exports.setup = function (callback) {
  var client = pkgcloud.providers.rackspace.storage.createClient({
    username: config.rackspaceUsername(),
    apiKey: config.rackspaceAPIKey(),
    region: config.rackspaceRegion(),
    useInternal: config.rackspaceServiceNet()
  });

  client.auth(function (err) {
    if (err) throw err;

    exports.client = client;

    async.parallel([
      makeContainerCreator(client, config.contentContainer(), "contentContainer", false),
      makeContainerCreator(client, config.assetContainer(), "assetContainer", true),
      mongoInit
    ], callback);
  });
};
