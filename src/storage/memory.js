var _ = require('lodash');

/**
 * @description Storage driver that uses entirely in-memory data structures.
 *
 * This is useful for unit testing and for local builds.
 */
function MemoryStorage() {}

MemoryStorage.prototype.setup = function(callback) {
  this.envelopes = {};
  this.assets = {};
  this.namedAssets = {};
  this.keys = {};

  callback();
};

MemoryStorage.prototype.uploadAsset = function(asset, callback) {
  var assetBody = "";
  for (var i = 0; i < asset.chunks.length; i++) {
    assetBody += asset.chunks[i].toString();
  }

  this.assets[asset.filename] = {
    contentType: asset.type,
    body: assetBody
  };

  asset.publicURL = "/asset/" + asset.filename;

  callback(null, asset);
};

MemoryStorage.prototype.nameAsset = function(asset, callback) {
  this.namedAssets[asset.key] = {
    key: asset.key,
    publicURL: asset.publicURL
  };

  callback(null, asset);
};

MemoryStorage.prototype.enumerateNamedAssets = function(callback) {
  callback(null, _.values(this.namedAssets));
};

module.exports = {
  MemoryStorage: MemoryStorage
};
