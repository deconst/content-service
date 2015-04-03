// Manage a connection to the Rackspace cloud. Retain and export handles to created resources.

var
  async = require('async'),
  pkgcloud = require('pkgcloud');

/**
 * @description Create a function that asynchronously creates a Rackspace container if it
 *   doesn't already exist.
 */
function make_container_creator(client, container_name, logical_name, cdn) {
  return function (callback) {
    var report_back = function (err, container) {
      exports[logical_name] = container;
      callback(null, container);
    };

    var cdn_enable = function (err, container) {
      container.enableCdn(container);
    };

    var handle_creation = cdn ? cdn_enable : report_back;

    // Instead of checking if the container exists first, we try to create it, and
    // if it already exists, we get a no-op (202) and move on.
    client.createContainer({ name: container_name, ttl: 31556940 }, handle_creation);
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

exports.setup = function (config, callback) {
  var client = pkgcloud.providers.rackspace.storage.createClient({
    username: config.rackspace_username(),
    apiKey: config.rackspace_apikey(),
    region: config.rackspace_region()
  });
  exports.client = client;

  async.parallel([
    make_container_creator(client, config.content_container(), "content_container", false),
    make_container_creator(client, config.asset_container(), "asset_container", true),
  ], callback);
};
