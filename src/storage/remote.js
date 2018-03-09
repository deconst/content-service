'use strict';

const async = require('async');
const request = require('request');
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
  const mongoIndices = (cb) => {
    mongoCollection('envelopes').createIndex({ contentID: 1 }, { unique: true }, cb);
  };

  const elasticIndices = (cb) => {
    if (!connection.elastic) return cb(null);

    // Attempt to create the latch index. If we can, we're responsible for setting up the initial
    // index and alias. Otherwise, another content service is on it.
    connection.elastic.indices.create({ index: 'latch', ignore: 400 }, (err, response, status) => {
      if (err) return cb(err);

      if (status === 400) {
        // The latch index already existed, so another service is creating the search indices.
        // Note that there's a race condition that occurs when a service that *isn't* creating
        // the search indices attempts to store content between the creation of the latch index
        // and the makeIndexActive() call below in the service that is.
        return cb(null);
      }

      let indexName = `envelopes_${Date.now()}`;
      this.createNewIndex(indexName, (err) => {
        if (err) return cb(err);

        this.makeIndexActive(indexName, cb);
      });
    });
  };

  connection.setup((err) => {
    if (err) return callback(err);

    async.parallel([mongoIndices, elasticIndices], callback);
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
 * @description Return the public CDN URL of a (possibly hypothetical) asset filename.
 */
RemoteStorage.prototype.assetPublicURL = function (filename) {
  return this.assetURLPrefix() + encodeURIComponent(filename);
};

/**
 * @description Upload an asset to the Cloud Files asset container.
 */
RemoteStorage.prototype.storeAsset = function (stream, filename, contentType, callback) {
  const up = connection.cloud.upload({
    container: config.assetContainer(),
    remote: filename,
    contentType: contentType,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  });

  up.on('error', callback);

  up.on('success', () => {
    const publicURL = this.assetPublicURL(filename);
    callback(null, publicURL);
  });

  stream.pipe(up);
};

/**
 * @description Upload many assets to Cloud Files in one request.
 */
RemoteStorage.prototype.bulkStoreAssets = function (stream, callback) {
  connection.cloud.extract({
    container: config.assetContainer(),
    stream,
    format: 'tar.gz',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': ''
    }
  }, callback);
};

/**
 * @description Store this asset in the MongoDB named asset collection, overwriting one with the
 * same name if present.
 */
RemoteStorage.prototype.nameAsset = function (name, publicURL, callback) {
  const filter = { key: name };
  const op = { $set: { key: name, publicURL } };
  const options = { upsert: true };

  mongoCollection('layoutAssets').findOneAndUpdate(filter, op, options, callback);
};

/**
 * @description List all assets that have been persisted in Mongo with nameAsset.
 */
RemoteStorage.prototype.findNamedAssets = function (callback) {
  mongoCollection('layoutAssets').find().toArray(callback);
};

/**
 * @description Yield true if an asset exists or false if it does not.
 */
RemoteStorage.prototype.assetExists = function (filename, callback) {
  const u = this.assetPublicURL(filename);

  request({ url: u, method: 'HEAD' }, (err, response, body) => {
    if (err) return callback(err);

    if (response.statusCode === 404) return callback(null, false);
    if (response.statusCode === 200) return callback(null, true);

    const e = new Error('Unexpected status code from Cloud Files');
    e.statusCode = response.statusCode;
    e.body = body;
    callback(e, false);
  });
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

RemoteStorage.prototype._storeEnvelope = function (contentID, doc, callback) {
  const filter = { contentID };
  const options = { upsert: true };

  mongoCollection('envelopes').findOneAndReplace(filter, doc, options, callback);
};

RemoteStorage.prototype._getEnvelope = function (contentID, callback) {
  mongoCollection('envelopes').find({ contentID }).limit(1).next((err, envelope) => {
    if (err) {
      err.contentID = contentID;
      err.statusCode = 500;
      return callback(err);
    }

    if (envelope === null) {
      let err = new Error('Envelope not found');
      err.contentID = contentID;
      err.statusCode = 404;
      return callback(err);
    }

    callback(null, envelope);
  });
};

RemoteStorage.prototype.deleteEnvelope = function (contentID, callback) {
  mongoCollection('envelopes').deleteOne({ contentID }, callback);
};

RemoteStorage.prototype.bulkDeleteEnvelopes = function (contentIDs, callback) {
  const ops = contentIDs.map((contentID) => {
    return { deleteOne: { filter: { contentID } } };
  });

  const options = { ordered: false };

  mongoCollection('envelopes').bulkWrite(ops, options, callback);
};

/**
 * @description Query for the existence and fingerprint matches of a set of content IDs. The result
 * object will have the structure:
 *
 * { contentID: { present: Boolean, matches: Boolean }}
 */
RemoteStorage.prototype.envelopesExist = function (contentIDMap, callback) {
  const query = { contentID: { $in: Object.keys(contentIDMap) } };
  const projection = { contentID: 1, fingerprint: 1 };

  const results = Object.keys(contentIDMap).reduce((object, contentID) => {
    object[contentID] = { present: false, matches: false };
    return object;
  }, {});

  mongoCollection('envelopes').find(query).project(projection).forEach((envelope) => {
    results[envelope.contentID].present = true;
    results[envelope.contentID].matches = envelope.fingerprint === contentIDMap[envelope.contentID];
  }, (err) => callback(err, results));
};

RemoteStorage.prototype._envelopeCursor = function (options) {
  let filter = {};

  if (options.prefix) {
    filter = { contentID: { $regex: `^${options.prefix}` } };
  }

  let cursor = mongoCollection('envelopes').find(filter);

  if (options.skip) cursor = cursor.skip(options.skip);
  if (options.limit) cursor = cursor.limit(options.limit);

  return cursor;
};

RemoteStorage.prototype.listEnvelopes = function (options, eachCallback, endCallback) {
  this._envelopeCursor(options).forEach(eachCallback, endCallback);
};

RemoteStorage.prototype.countEnvelopes = function (options, callback) {
  this._envelopeCursor(options).count(true, callback);
};

RemoteStorage.prototype.createNewIndex = function (indexName, callback) {
  if (!connection.elastic) return callback(null);

  let envelopeMapping = {
    properties: {
      title: { type: 'text', index: true, copy_to: 'all' },
      body: { type: 'text', index: true, copy_to: 'all' },
      keywords: { type: 'text', index: true, copy_to: 'all' },
      categories: { type: 'text', index: false, copy_to: 'all' }
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

RemoteStorage.prototype._indexEnvelope = function (contentID, envelope, indexName, callback) {
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
      ignoreUnavailable: true
    }, (err, response, status) => {
      if (err) return callback(err);

      let indexNames = Object.keys(response).filter((n) => n !== indexName);

      async.each(indexNames, (name, cb) => {
        connection.elastic.indices.delete({ index: name }, cb);
      }, callback);
    });
  });
};

RemoteStorage.prototype.queryEnvelopes = function (query, categories, pageNumber, perPage, callback) {
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
    q.match = { all: query };
  } else {
    q.bool = {
      must: {
        match: { all : query },
        filter: { terms: { categories: categories } }
      }
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

RemoteStorage.prototype.unindexEnvelope = function (contentID, callback) {
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

RemoteStorage.prototype.bulkUnindexEnvelopes = function (contentIDs, callback) {
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
