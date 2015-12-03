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
 * @description Return prefix of the URL that assets are served under.
 */
RemoteStorage.prototype.assetURLPrefix = function () {
  return connection.assetContainer.cdnSslUri + '/';
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
    asset.publicURL = this.assetURLPrefix() + encodeURIComponent(asset.filename);
    callback(null, asset);
  }.bind(this));

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
 * @description Retrieve an asset directly through the content service API. This is useless for
 *  remote storage (because you can and should use the CDN url instead) but implemented for
 *  parity with memory storage.
 */
RemoteStorage.prototype.getAsset = function (filename, callback) {
  var source = connection.client.download({
    container: config.assetContainer(),
    remote: filename
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

    callback(null, { contentType: resp.contentType, body: complete });
  });
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

RemoteStorage.prototype._storeContent = function (contentID, content, callback) {
  var dest = connection.client.upload({
    container: config.contentContainer(),
    remote: encodeURIComponent(contentID)
  });

  dest.on('err', callback);

  dest.on('success', function () {
    callback();
  });

  dest.end(content);
};

RemoteStorage.prototype._getContent = function (contentID, callback) {
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

RemoteStorage.prototype.listContent = function (callback) {
  var perPage = 10000;

  var nextPage = function (marker) {
    var options = { limit: perPage };
    if (marker !== null) {
      options.marker = marker;
    }

    connection.client.getFiles(config.contentContainer(), options, function (err, files) {
      if (err) return callback(err);

      var fileNames = files.map(function (e) { return decodeURIComponent(e.name); });

      var next = function () {
        // The last page was empty. We're done and we've already sent our done sentinel.
        if (fileNames.length === 0) return;

        if (fileNames.length < perPage) {
          // Enumeration is complete. Invoke the callback a final time with an empty result set
          // to signal completion.
          callback(null, [], function () {});
          return;
        }

        // We (may) still have files to go. Onward to the next page.
        nextPage(fileNames[fileNames.length - 1]);
      };

      callback(null, fileNames, next);
    });
  };

  nextPage(null);
};

RemoteStorage.prototype._indexContent = function (contentID, envelope, callback) {
  connection.elastic.index({
    index: 'envelopes',
    type: 'envelope',
    id: contentID,
    body: envelope
  }, callback);
};

RemoteStorage.prototype.queryContent = function (query, pageNumber, perPage, callback) {
  connection.elastic.search({
    index: 'envelopes',
    from: (pageNumber - 1) * perPage,
    size: perPage,
    ignoreUnavailable: true,
    body: {
      query: {
        match: { _all: query }
      },
      highlight: {
        fields: {
          body: {}
        }
      }
    }
  }, callback);
};

RemoteStorage.prototype.unindexContent = function (contentID, callback) {
  connection.elastic.delete({
    index: 'envelopes',
    id: contentID
  }, callback);
};

RemoteStorage.prototype.storeSHA = function (sha, callback) {
  connection.db.collection('sha').updateOne({
    key: 'controlRepository'
  }, {
    $set: {
      key: 'controlRepository',
      sha: sha
    }
  }, {
    upsert: true
  }, callback);
};

RemoteStorage.prototype.getSHA = function (callback) {
  connection.db.collection('sha').findOne({key: 'controlRepository'}, function (err, doc) {
    if (err) {
      return callback(err);
    }

    if (doc === null) {
      return callback(null, null);
    }

    callback(null, doc.sha);
  });
};

module.exports = {
  RemoteStorage: RemoteStorage
};
