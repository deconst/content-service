var connection = require('./connection');

/**
 * @description Storage driver that persists:
 *
 * * Metadata envelopes in a private Cloud Files container.
 * * Assets in a CDN-enabled Cloud Files container.
 * * API keys in MongoDB.
 *
 * This is used in deployed clusters.
 */
function RemoteStorage() {}

/**
 * @description Initialize connections to external systems.
 */
RemoteStorage.prototype.setup = function (callback) {
  connection.setup(callback);
}

module.exports = {
  RemoteStorage: RemoteStorage
},
