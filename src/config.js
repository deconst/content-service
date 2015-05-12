// Read configuration from the environment, reporting anything that's missing.

var
  pkgcloud = require('pkgcloud'),
  childProcess = require('child_process'),
  info = require('../package.json');

var configuration = {
  rackspaceUsername: {
    env: "RACKSPACE_USERNAME"
  },
  rackspaceAPIKey: {
    env: "RACKSPACE_APIKEY"
  },
  rackspaceRegion: {
    env: "RACKSPACE_REGION"
  },
  adminAPIKey: {
    env: "ADMIN_APIKEY"
  },
  contentContainer: {
    env: "CONTENT_CONTAINER"
  },
  assetContainer: {
    env: "ASSET_CONTAINER"
  },
  mongodbURL: {
    env: "MONGODB_URL"
  },
  contentLogLevel: {
    env: "CONTENT_LOG_LEVEL",
    def: "info"
  }
};

var commit = childProcess.execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();

/**
 * @description Create a getter function for the named function.
 */
function makeGetter(settingName) {
  return function () {
    return configuration[settingName].value;
  };
}

exports.configure = function (env) {
  var missing = [];

  for (var name in configuration) {
    var setting = configuration[name];
    var value = env[setting.env];

    setting.value = value || setting.def;

    if (!setting.value) {
      missing.push(setting.env);
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
  exports[name] = makeGetter(name);
}

// Re-export the package.json data and the current git commit.
exports.info = info;
exports.commit = commit;
