var connection = require('./connection');
var config = require('../config');

/**
 * @description Storage driver that persists:
 *
 * * Metadata envelopes in a private Cloud Files container.
 * * Assets in a CDN-enabled Cloud Files container.
 * * API keys in MongoDB.
 *
 * This is used in deployed clusters.
 */
function RemoteStorage () {}

/**
 * @description Initialize connections to external systems.
 */
RemoteStorage.prototype.setup = function (callback) {
  connection.setup(callback);
};

/**
 * @description Do nothing, because writing code to wipe production clean feels like a *bad* idea.
 */
RemoteStorage.prototype.clear = function (callback) {
  callback(null);
};

/**
 * @description Upload an asset to the Cloud Files asset container.
 */
RemoteStorage.prototype.storeAsset = function (asset, callback) {
  var up = connection.client.upload({
    container: config.assetContainer(),
    remote: asset.filename,
    contentType: asset.type,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  });

  up.on('error', callback);

  up.on('success', function () {
    var baseURI = connection.assetContainer.cdnSslUri;
    asset.publicURL = baseURI + '/' + encodeURIComponent(asset.filename);
    callback(null, asset);
  });

  asset.chunks.forEach(function (chunk) {
    up.write(chunk);
  });

  up.end();
};

/**
 * @description Store this asset in the MongoDB named asset collection, overwriting one with the
 * same name if present.
 */
RemoteStorage.prototype.nameAsset = function (asset, callback) {
  connection.db.collection('layoutAssets').updateOne({
    key: asset.key
  }, {
    $set: {
      key: asset.key,
      publicURL: asset.publicURL
    }
  }, {
    upsert: true
  },
    function (err) {
      callback(err, asset);
    }
  );
};

/**
 * @description List all assets that have been persisted in Mongo with nameAsset.
 */
RemoteStorage.prototype.findNamedAssets = function (callback) {
  connection.db.collection('layoutAssets').find().toArray(callback);
};

/**
 * @description Store a newly generated API key in the keys collection.
 */
RemoteStorage.prototype.storeKey = function (key, callback) {
  connection.db.collection('apiKeys').insertOne(key, callback);
};

/**
 * @description Forget a previously stored API key by key value.
 */
RemoteStorage.prototype.deleteKey = function (apikey, callback) {
  connection.db.collection('apiKeys').deleteOne({
    apikey: apikey
  }, callback);
};

/**
 * @description Return an Array of keys that match the provided API key. Will most frequently
 *   return either zero or one results, but you never know.
 */
RemoteStorage.prototype.findKeys = function (apikey, callback) {
  connection.db.collection('apiKeys').find({
    apikey: apikey
  }).toArray(callback);
};

RemoteStorage.prototype.storeContent = function (contentID, content, callback) {
  var dest = connection.client.upload({
    container: config.contentContainer(),
    remote: encodeURIComponent(contentID)
  });

  dest.end(content, callback);
};

RemoteStorage.prototype.getContent = function (contentID, callback) {
  var source = connection.client.download({
    container: config.contentContainer(),
    remote: encodeURIComponent(contentID)
  });
  var chunks = [];

  source.on('error', function (err) {
    callback(err);
  });

  source.on('data', function (chunk) {
    chunks.push(chunk);
  });

  source.on('complete', function (resp) {
    var complete = Buffer.concat(chunks);

    if (resp.statusCode > 400) {
      var err = new Error('Cloud Files error');

      err.statusCode = resp.statusCode;
      err.responseBody = complete;

      return callback(err);
    }

    callback(null, complete);
  });
};

RemoteStorage.prototype.deleteContent = function (contentID, callback) {
  connection.client.removeFile(config.contentContainer(), encodeURIComponent(contentID), callback);
};

module.exports = {
  RemoteStorage: RemoteStorage
};
