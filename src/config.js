'use strict';
// Read configuration from the environment, reporting anything that's missing.

const childProcess = require('child_process');
const _ = require('lodash');
const info = require('../package.json');

const configuration = {
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
  memoryAssetPrefix: {
    env: 'MEMORY_ASSET_PREFIX',
    def: '/__local_asset__/'
  },
  mongodbURL: {
    env: 'MONGODB_URL'
  },
  mongodbPrefix: {
    env: 'MONGODB_PREFIX',
    def: ''
  },
  elasticsearchHost: {
    env: 'ELASTICSEARCH_HOST',
    def: null
  },
  contentLogLevel: {
    env: 'CONTENT_LOG_LEVEL',
    def: 'info'
  },
  contentLogColor: {
    env: 'CONTENT_LOG_COLOR',
    def: 'false'
  },
  proxyUpstream: {
    env: 'PROXY_UPSTREAM',
    def: null
  },
  stagingMode: {
    env: 'STAGING_MODE',
    def: 'false'
  }
};

const commit = childProcess.execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

/**
 * @description Create a getter function for the named function.
 */
function makeGetter (settingName) {
  return function () {
    return configuration[settingName].value;
  };
}

function interpretAsBoolean (settingName) {
  const v = configuration[settingName].value;
  if (v !== null && v !== undefined && v !== '' && v !== 'true' && v !== 'false') {
    console.error(`The boolean property ${configuration[settingName].env} does not have a correct value!`);
    console.error('Boolean configuration settings must be either:');
    console.error('* Omitted entirely');
    console.error('* Blank');
    console.error('* One of the strings "true" or "false"');
    console.error(`This setting is currently: "${v}"`);

    throw new Error('Unrecognized boolean value');
  }

  configuration[settingName].value = v === 'true';
}

exports.configure = function (env) {
  let missing = [];

  for (let name in configuration) {
    let setting = configuration[name];
    let value = env[setting.env];

    setting.value = value || setting.def;

    if (setting.value === undefined) {
      missing.push(setting.env);
    }
  }

  // Normalize storage as a lower-case string
  configuration.storage.value = configuration.storage.value.toLowerCase();

  // If storage is remote, remove remote-only-mandatory settings from the missing list.
  if (configuration.storage.value === 'memory') {
    missing = _.without(missing,
      'RACKSPACE_USERNAME', 'RACKSPACE_APIKEY', 'RACKSPACE_REGION',
      'CONTENT_CONTAINER', 'ASSET_CONTAINER',
      'MONGODB_URL');
  } else if (configuration.storage.value === 'hybrid') {
    missing = _.without(missing, 'RACKSPACE_USERNAME', 'RACKSPACE_APIKEY', 'RACKSPACE_REGION');
  }

  // Normalize rackspaceServiceNet, contentLogColor, and stagingMode as booleans.
  interpretAsBoolean('rackspaceServiceNet');
  interpretAsBoolean('contentLogColor');
  interpretAsBoolean('stagingMode');

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
  if (configuration.storage.value !== 'remote' && configuration.storage.value !== 'memory' && configuration.storage.value !== 'hybrid') {
    console.error('STORAGE must be either "remote", "hybrid" or "memory".');

    throw new Error('Invalid configuration');
  }

  // Ensure that PROXY_UPSTREAM is provided if STAGING_MODE is.
  if (configuration.stagingMode.value && !configuration.proxyUpstream.value) {
    console.error('PROXY_UPSTREAM must be set when STAGING_MODE is enabled.');

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
