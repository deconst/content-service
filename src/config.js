// Read configuration from the environment, reporting anything that's missing.

var configuration = {
  rackspace_username: null,
  rackspace_apikey: null,
  rackspace_region: null,
  rackspace_container: null,
};

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
    var value = process.env[upper];

    configuration[name] = value;

    if (!value) {
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
