// Manage a connection to the Rackspace cloud. Retain and export handles to created resources.

var
  async = require('async'),
  pkgcloud = require('pkgcloud'),
  mongo = require('mongodb'),
  config = require('./config'),
  log = require('./logging').logger;

/**
 * @description Create a function that asynchronously creates a Rackspace container if it
 *   doesn't already exist.
 */
function make_container_creator(client, container_name, logical_name, cdn) {
  return function (callback) {
    var report_back = function (err, container) {
      exports[logical_name] = container;

      log.debug("Container [" + container.name + "] now exists.");

      callback(null, container);
    };

    var cdn_enable = function (err, container) {
      log.debug("Enabling CDN on container [" + container.name + "].");

      client.setCdnEnabled(container, { ttl: 31536000, enabled: true }, report_back);
    };

    var handle_creation = cdn ? cdn_enable : report_back;

    log.info("Ensuring that container [" + container_name + "] exists.");

    // Instead of checking if the container exists first, we try to create it, and
    // if it already exists, we get a no-op (202) and move on.
    client.createContainer({ name: container_name }, handle_creation);
  };
}

/**
 * @description Utility function to ensure that the exported Container model includes CDN URIs when
 *   it's supposed to.
 */
function refresh(client, container_name, logical_name, callback) {
  client.getContainer(container_name, function (err, container) {
    if (err) {
      callback(err);
      return;
    }

    exports[logical_name] = container;

    callback(null);
  });
}

/**
 * @description Authenticate to MongoDB, export the active MongoDB connection as "db", and
 *   perform any necessary one-time initialization.
 */
function mongo_init(callback) {
  mongo.MongoClient.connect(config.mongodb_url(), function (err, db) {
    if (err) return callback(err);

    log.debug("Connected to MongoDB database at [" + config.mongodb_url() + "].");

    exports.db = db;

    var envelopes = db.collection("envelopes");

    // Create indices on collections as necessary.
    async.parallel([
      function (callback) { envelopes.createIndex("tags", { sparse: true }, callback); },
      function (callback) { envelopes.createIndex("categories", { sparse: true }, callback); },
    ], function (err, db) {
      if (err) return callback(err);

      log.debug("All indices created.");

      callback(null);
    });
  });
}

exports.setup = function (callback) {
  var client = pkgcloud.providers.rackspace.storage.createClient({
    username: config.rackspace_username(),
    apiKey: config.rackspace_apikey(),
    region: config.rackspace_region()
  });
  exports.client = client;

  async.parallel([
    make_container_creator(client, config.content_container(), "content_container", false),
    make_container_creator(client, config.asset_container(), "asset_container", true),
    mongo_init
  ], callback);
};
