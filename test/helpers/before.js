/*
 * Suite-global initialization that should occur before any other files are required. It's probably
 * a code smell that I have to do this.
 */

var config = require('../../src/config');

function reconfigure () {
  if (process.env.INTEGRATION) {
    console.log('Integration test mode active.');

    config.configure(process.env);

    console.log('NOTE: This will leave files uploaded in Cloud Files containers.');
    console.log('Be sure to clear these containers after:');
    console.log('[' + config.contentContainer() + '] and [' + config.assetContainer() + ']');
  } else {
    config.configure({
      STORAGE: 'memory',
      RACKSPACE_USERNAME: 'me',
      RACKSPACE_APIKEY: '12345',
      RACKSPACE_REGION: 'space',
      ADMIN_APIKEY: process.env.ADMIN_APIKEY || '12345',
      CONTENT_CONTAINER: 'the-content-container',
      ASSET_CONTAINER: 'the-asset-container',
      MONGODB_URL: 'mongodb-url',
      CONTENT_LOG_LEVEL: process.env.CONTENT_LOG_LEVEL || 'error'
    });
  }
}

reconfigure();

exports.reconfigure = reconfigure;
