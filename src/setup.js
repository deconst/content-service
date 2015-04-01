// Actions to be performed on application launch.

/**
 * @description Create a function that asynchronously creates a Rackspace container if it
 *   doesn't already exist.
 */
function make_container_creator(config, container_name) {
  return function (callback) {
    // Instead of checking if the container exists first, we try to create it, and
    // if it already exists, we get a no-op (202) and move on.
    config.client.createContainer({ name: container_name }, callback);
  };
}

module.exports = function (config, callback) {
  make_container_creator(config, config.rackspace_container())(callback);
};
