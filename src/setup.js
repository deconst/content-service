// Actions to be performed on application launch.

var async = require('async');

/**
 * @description Create a function that asynchronously creates a Rackspace container if it
 *   doesn't already exist.
 */
function make_container_creator(client, container_name, cdn) {
  return function (callback) {
    var handleCreation = callback;
    if (cdn) {
      handleCreation = function (err, container) {
        container.enableCdn(callback);
      };
    }

    // Instead of checking if the container exists first, we try to create it, and
    // if it already exists, we get a no-op (202) and move on.
    client.createContainer({ name: container_name }, handleCreation);
  };
}

module.exports = function (config, callback) {
  async.parallel([
    make_container_creator(config.client, config.content_container(), false),
    make_container_creator(config.client, config.asset_container(), true),
  ], callback);
};
