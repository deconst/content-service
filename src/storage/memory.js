var _ = require('lodash');

/**
 * @description Storage driver that uses entirely in-memory data structures.
 *
 * This is useful for unit testing and for local builds.
 */
function MemoryStorage () {}

MemoryStorage.prototype.setup = function (callback) {
  this.clear(callback);
};

MemoryStorage.prototype.clear = function (callback) {
  this.envelopes = {};
  this.indexedEnvelopes = [];
  this.assets = {};
  this.namedAssets = {};
  this.keys = {};
  this.sha = null;

  callback();
};

/**
 * @description Return prefix of the URL that assets are served under.
 */
MemoryStorage.prototype.assetURLPrefix = function () {
  return '/__local_asset__/';
};

MemoryStorage.prototype.storeAsset = function (asset, callback) {
  var assetBody = Buffer.concat(asset.chunks);

  this.assets[asset.filename] = {
    contentType: asset.type,
    body: assetBody
  };

  asset.publicURL = this.assetURLPrefix() + encodeURIComponent(asset.filename);

  callback(null, asset);
};

MemoryStorage.prototype.nameAsset = function (asset, callback) {
  this.namedAssets[asset.key] = {
    key: asset.key,
    publicURL: asset.publicURL
  };

  callback(null, asset);
};

MemoryStorage.prototype.findNamedAssets = function (callback) {
  callback(null, _.values(this.namedAssets));
};

MemoryStorage.prototype.getAsset = function (filename, callback) {
  var asset = this.assets[filename];

  if (asset === undefined) {
    var err = new Error('Memory storage error');

    err.statusCode = 404;
    err.responseBody = 'Oh snap';

    return callback(err);
  }

  callback(null, asset);
};

MemoryStorage.prototype.storeKey = function (key, callback) {
  this.keys[key.apikey] = key.name;
  callback();
};

MemoryStorage.prototype.deleteKey = function (apikey, callback) {
  delete this.keys[apikey];
  callback();
};

MemoryStorage.prototype.findKeys = function (apikey, callback) {
  var name = this.keys[apikey];
  if (name) {
    callback(null, [{
      apikey: apikey,
      name: name
    }]);
  } else {
    callback(null, []);
  }
};

MemoryStorage.prototype.storeContent = function (contentID, content, callback) {
  this.envelopes[contentID] = content;
  callback();
};

MemoryStorage.prototype.getContent = function (contentID, callback) {
  var envelope = this.envelopes[contentID];

  if (envelope === undefined) {
    var err = new Error('Memory storage error');

    err.statusCode = 404;
    err.responseBody = 'Oh snap';

    return callback(err);
  }

  callback(null, envelope);
};

MemoryStorage.prototype.deleteContent = function (contentID, callback) {
  delete this.envelopes[contentID];

  callback();
};

MemoryStorage.prototype.listContent = function (callback) {
  var ids = Object.keys(this.envelope);

  callback(null, ids, function () {
    if (ids.length > 0) {
      callback(null, [], function () {});
    }
  });
};

MemoryStorage.prototype.indexContent = function (contentID, envelope, callback) {
  this.indexedEnvelopes.push({
    id: contentID,
    _source: envelope
  });

  callback();
};

MemoryStorage.prototype.storeSHA = function (sha, callback) {
  this.sha = sha;

  callback(null);
};

MemoryStorage.prototype.getSHA = function (callback) {
  callback(null, this.sha);
};

module.exports = {
  MemoryStorage: MemoryStorage
};
