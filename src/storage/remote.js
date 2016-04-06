'use strict';

const async = require('async');
const connection = require('./connection');
const config = require('../config');

/**
 * @description Storage driver that persists:
 *
 * * Assets in a CDN-enabled Cloud Files container.
 * * Metadata envelopes and API keys in MongoDB.
 *
 * This is used in deployed clusters.
 */
function RemoteStorage () {}

exports.RemoteStorage = RemoteStorage;

/**
 * @description Initialize connections to external systems.
 */
RemoteStorage.prototype.setup = function (callback) {
  connection.setup((err) => {
    if (err) return callback(err);

    if (!connection.elastic) return callback(null);

    // Attempt to create the latch index. If we can, we're responsible for setting up the initial
    // index and alias. Otherwise, another content service is on it.
    connection.elastic.indices.create({ index: 'latch', ignore: 400 }, (err, response, status) => {
      if (err) return callback(err);

      if (status === 400) {
        // The latch index already existed, so another service is creating the search indices.
        // Note that there's a race condition that occurs when a service that *isn't* creating
        // the search indices attempts to store content between the creation of the latch index
        // and the makeIndexActive() call below in the service that is.
        return callback(null);
      }

      let indexName = `envelopes_${Date.now()}`;
      this.createNewIndex(indexName, (err) => {
        if (err) return callback(err);

        this.makeIndexActive(indexName, callback);
      });
    });
  });
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
  var up = connection.cloud.upload({
    container: config.assetContainer(),
    remote: asset.filename,
    contentType: asset.type,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  });

  up.on('error', callback);

  up.on('success', () => {
    asset.publicURL = this.assetURLPrefix() + encodeURIComponent(asset.filename);
    callback(null, asset);
  });

  asset.chunks.forEach((chunk) => up.write(chunk));

  up.end();
};

/**
 * @description Store this asset in the MongoDB named asset collection, overwriting one with the
 * same name if present.
 */
RemoteStorage.prototype.nameAsset = function (asset, callback) {
  mongoCollection('layoutAssets').updateOne({
    key: asset.key
  }, {
    $set: {
      key: asset.key,
      publicURL: asset.publicURL
    }
  }, {
    upsert: true
  },
    (err) => callback(err, asset)
  );
};

/**
 * @description List all assets that have been persisted in Mongo with nameAsset.
 */
RemoteStorage.prototype.findNamedAssets = function (callback) {
  mongoCollection('layoutAssets').find().toArray(callback);
};

/**
 * @description Retrieve an asset directly through the content service API. This is useless for
 *  remote storage (because you can and should use the CDN url instead) but implemented for
 *  parity with memory storage.
 */
RemoteStorage.prototype.getAsset = function (filename, callback) {
  const source = connection.cloud.download({
    container: config.assetContainer(),
    remote: filename
  });
  const chunks = [];

  source.on('error', callback);

  source.on('data', (chunk) => chunks.push(chunk));

  source.on('complete', (resp) => {
    const complete = Buffer.concat(chunks);

    if (resp.statusCode > 400) {
      const err = new Error('Cloud Files error');

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
  mongoCollection('apiKeys').insertOne(key, callback);
};

/**
 * @description Forget a previously stored API key by key value.
 */
RemoteStorage.prototype.deleteKey = function (apikey, callback) {
  mongoCollection('apiKeys').deleteOne({
    apikey: apikey
  }, callback);
};

/**
 * @description Return an Array of keys that match the provided API key. Will most frequently
 *   return either zero or one results, but you never know.
 */
RemoteStorage.prototype.findKeys = function (apikey, callback) {
  mongoCollection('apiKeys').find({
    apikey: apikey
  }).toArray(callback);
};

RemoteStorage.prototype._storeContent = function (contentID, envelope, callback) {
  const filter = { contentID };
  const options = { upsert: true };
  const doc = {
    contentID,
    lastUpdate: Date.now(),
    envelope
  };

  mongoCollection('envelopes').findOneAndReplace(filter, doc, options, callback);
};

RemoteStorage.prototype._getContent = function (contentID, callback) {
  mongoCollection('envelopes').find({ contentID }).limit(1).next((err, envelope) => {
    if (err) return callback(err);
    return callback(envelope);
  });
};

RemoteStorage.prototype.deleteContent = function (contentID, callback) {
  mongoCollection('envelopes').deleteOne({ contentID }, callback);
};

RemoteStorage.prototype.bulkDeleteContent = function (contentIDs, callback) {
  const ops = contentIDs.map((contentID) => {
    return { deleteOne: { filter: { contentID } } };
  });

  const options = { ordered: false };

  mongoCollection('envelopes').bulkWrite(ops, options, callback);
};

RemoteStorage.prototype.listContent = function (prefix, eachCallback, endCallback) {
  let filter = {};

  if (prefix) {
    filter = { contentID: { $regex: `^${prefix}` } };
  }

  const iter = (doc) => eachCallback(null, doc);
  const end = (err) => endCallback(err);

  mongoCollection('envelopes').find(filter).forEach(iter, end);
};

RemoteStorage.prototype.createNewIndex = function (indexName, callback) {
  if (!connection.elastic) return callback(null);

  let envelopeMapping = {
    properties: {
      title: { type: 'string', index: 'analyzed' },
      body: { type: 'string', index: 'analyzed' },
      keywords: { type: 'string', index: 'analyzed' },
      categories: { type: 'string', index: 'not_analyzed' }
    }
  };

  connection.elastic.indices.create({ index: indexName }, (err) => {
    if (err) return callback(err);

    connection.elastic.indices.putMapping({
      index: indexName,
      type: 'envelope',
      body: {
        envelope: envelopeMapping
      }
    }, callback);
  });
};

RemoteStorage.prototype._indexContent = function (contentID, envelope, indexName, callback) {
  if (!connection.elastic) return callback(null);

  connection.elastic.index({
    index: indexName,
    type: 'envelope',
    id: contentID,
    body: envelope
  }, callback);
};

RemoteStorage.prototype.makeIndexActive = function (indexName, callback) {
  if (!connection.elastic) return callback(null);

  connection.elastic.indices.updateAliases({
    body: {
      actions: [
        { remove: { index: '*', alias: 'envelopes_current' } },
        { add: { index: indexName, alias: 'envelopes_current' } }
      ]
    }
  }, (err) => {
    if (err) return callback(err);

    connection.elastic.indices.get({
      index: 'envelopes*',
      ignoreUnavailable: true,
      feature: '_settings'
    }, (err, response, status) => {
      if (err) return callback(err);

      let indexNames = Object.keys(response).filter((n) => n !== indexName);

      async.each(indexNames, (name, cb) => {
        connection.elastic.indices.delete({ index: name }, cb);
      }, callback);
    });
  });
};

RemoteStorage.prototype.queryContent = function (query, categories, pageNumber, perPage, callback) {
  if (!connection.elastic) {
    return callback(null, {
      hits: {
        hits: [],
        total: 0
      }
    });
  }

  const q = {};

  if (!categories) {
    q.match = { _all: query };
  } else {
    q.filtered = {
      query: { match: { _all: query } },
      filter: { terms: { categories: categories } }
    };
  }

  connection.elastic.search({
    index: 'envelopes_current',
    type: 'envelope',
    from: (pageNumber - 1) * perPage,
    size: perPage,
    ignoreUnavailable: true,
    body: {
      query: q,
      highlight: {
        fields: {
          body: {}
        }
      }
    }
  }, callback);
};

RemoteStorage.prototype.unindexContent = function (contentID, callback) {
  if (!connection.elastic) return callback(null);

  connection.elastic.delete({
    index: 'envelopes_current',
    type: 'envelope',
    id: contentID
  }, (err) => {
    if (err && err.status === '404') {
      // It's already gone. Disregard.
      return callback(null);
    }

    callback(err);
  });
};

RemoteStorage.prototype.bulkUnindexContent = function (contentIDs, callback) {
  if (!connection.elastic) return callback(null);

  const actions = contentIDs.map((id) => {
    return { delete: { _index: 'envelopes_current', _type: 'envelope', _id: id } };
  });

  connection.elastic.bulk({ body: actions }, callback);
};

RemoteStorage.prototype.storeSHA = function (sha, callback) {
  mongoCollection('sha').updateOne({
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
  mongoCollection('sha').findOne({key: 'controlRepository'}, (err, doc) => {
    if (err) return callback(err);

    if (doc === null) {
      return callback(null, null);
    }

    callback(null, doc.sha);
  });
};

function mongoCollection (name) {
  return connection.mongo.collection(config.mongodbPrefix() + name);
}
