// Read configuration from the environment, reporting anything that's missing.

var childProcess = require('child_process');
var _ = require('lodash');
var info = require('../package.json');

var configuration = {
  storage: {
    env: 'STORAGE',
    def: 'remote'
  },
  rackspaceUsername: {
    env: 'RACKSPACE_USERNAME'
  },
  rackspaceAPIKey: {
    env: 'RACKSPACE_APIKEY'
  },
  rackspaceRegion: {
    env: 'RACKSPACE_REGION'
  },
  rackspaceServiceNet: {
    env: 'RACKSPACE_SERVICENET',
    def: 'false'
  },
  adminAPIKey: {
    env: 'ADMIN_APIKEY'
  },
  contentContainer: {
    env: 'CONTENT_CONTAINER'
  },
  assetContainer: {
    env: 'ASSET_CONTAINER'
  },
  mongodbURL: {
    env: 'MONGODB_URL'
  },
  contentLogLevel: {
    env: 'CONTENT_LOG_LEVEL',
    def: 'info'
  },
  contentLogColor: {
    env: 'CONTENT_LOG_COLOR',
    def: 'false'
  }
};

var commit = childProcess.execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

/**
 * @description Create a getter function for the named function.
 */
function makeGetter (settingName) {
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

  // Normalize storage as a lower-case string
  configuration.storage.value = configuration.storage.value.toLowerCase();

  // If storage is not remote, remove remote-only-mandatory settings from the missing list.
  if (configuration.storage !== 'remote') {
    missing = _.without(missing,
      'RACKSPACE_USERNAME', 'RACKSPACE_APIKEY', 'RACKSPACE_REGION',
      'CONTENT_CONTAINER', 'ASSET_CONTAINER',
      'MONGODB_URL');
  }

  // Normalize rackspaceServiceNet and contentLogColor as booleans.
  configuration.rackspaceServiceNet.value = (configuration.rackspaceServiceNet.value === 'true');
  configuration.contentLogColor.value = (configuration.contentLogColor.value === 'true');

  if (missing.length !== 0) {
    console.error('Required configuration values are missing!');
    console.error('Please set the following environment variables:');
    console.error('');
    missing.forEach(function (settingName) {
      console.error('  ' + settingName);
    });
    console.error('');

    throw new Error('Inadequate configuration');
  }

  // Ensure that STORAGE is a recognized value.
  if (configuration.storage.value !== 'remote' && configuration.storage.value !== 'memory') {
    console.error('STORAGE must be either "remote" or "memory".');

    throw new Error('Invalid configuration');
  }
};

// Export "getter" functions for each configuration option.
for (var name in configuration) {
  exports[name] = makeGetter(name);
}

// Re-export the package.json data and the current git commit.
exports.info = info;
exports.commit = commit;
