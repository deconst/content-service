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

MemoryStorage.prototype.storeAsset = function(asset, callback) {
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

MemoryStorage.prototype.findNamedAssets = function(callback) {
  callback(null, _.values(this.namedAssets));
};

MemoryStorage.prototype.storeKey = function(key, callback) {
  this.keys[key.apikey] = key.name;
  callback();
};

MemoryStorage.prototype.deleteKey = function(apikey, callback) {
  delete this.keys[apikey];
  callback();
};

MemoryStorage.prototype.findKeys = function(apikey, callback) {
  var key = this.keys[apikey];
  if (key) {
    callback(null, [{
      apikey: key,
      name: key.name
    }]);
  } else {
    callback(null, []);
  }
};

MemoryStorage.prototype.storeContent = function(contentID, content, callback) {
  this.envelopes[contentID] = content;
  callback();
};

MemoryStorage.prototype.getContent = function(contentID, callback) {
  var envelope = this.envelopes[contentID];

  if (envelope === undefined) {
    var err = new Error("Memory storage error");

    err.statusCode = 404;
    err.responseBody = "Oh snap";

    return callback(err);
  }

  callback(null, envelope);
};

MemoryStorage.prototype.deleteContent = function(contentID, callback) {
  delete this.envelopes[contentID];

  callback();
};

module.exports = {
  MemoryStorage: MemoryStorage
};
