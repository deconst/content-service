// Read configuration from the environment, reporting anything that's missing.

var
  pkgcloud = require('pkgcloud'),
  child_process = require('child_process'),
  info = require('../package.json');

var configuration = {
  rackspace_username: null,
  rackspace_apikey: null,
  rackspace_region: null,
  content_container: null,
  admin_apikey: null,
  asset_container: null,
  mongodb_url: null,
  content_log_level: "info"
};

var commit = child_process.execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();

/**
 * @description Create a getter function for the named function.
 */
function make_getter(setting_name) {
  return function () {
    return configuration[setting_name];
  };
}

exports.configure = function (env) {
  var missing = [];

  for (var name in configuration) {
    var upper = name.toUpperCase();
    var value = env[upper];

    configuration[name] = value || configuration[name];

    if (!configuration[name]) {
      missing.push(upper);
    }
  }

  if (missing.length !== 0) {
    console.error("Required configuration values are missing!");
    console.error("Please set the following environment variables:");
    console.error("");
    missing.forEach(function (settingName) {
      console.error("  " + settingName);
    });
    console.error("");

    throw new Error("Inadequate configuration");
  }
};

// Export "getter" functions for each configuration option.
for (var name in configuration) {
  exports[name] = make_getter(name);
}

// Re-export the package.json data and the current git commit.
exports.info = info;
exports.commit = commit;
