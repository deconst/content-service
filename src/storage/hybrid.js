'use strict';

const async = require('async');
const request = require('request');
const connection = require('./connection');
const remote = require('./remote');
const getRawBody = require('raw-body');
const tar = require('tar-stream');
const zlib = require('zlib');
const _ = require('lodash');
const config = require('../config');

/**
 * @description Storage driver that persists:
 *
 * * Assets in a CDN-enabled Cloud Files container.
 * * Metadata envelopes and API keys in MongoDB.
 *
 * This is used in deployed clusters.
 */
function HybridStorage () {}

HybridStorage.prototype = Object.create(remote.RemoteStorage.prototype);

exports.HybridStorage = HybridStorage;

HybridStorage.prototype.clear = function (callback) {
  this.assets = {};
  this.namedAssets = {};
  this.keys = {};
  this.sha = null;

  if (callback) {
    callback();
  }
};

/**
 * @description Initialize connections to external systems.
 */
HybridStorage.prototype.setup = function (callback) {
  this.clear(null);

  const mongoIndices = (cb) => {
    mongoCollection('envelopes').createIndex({ contentID: 1 }, { unique: true }, cb);
  };

  const elasticIndices = (cb) => {
    if (!connection.elastic) return cb(null);

    // Attempt to create the latch index. If we can, we're responsible for setting up the initial
    // index and alias. Otherwise, another content service is on it.
    connection.elastic.indices.create({ index: 'latch', ignore: 400 }, (err, response, status) => {
      if (err) {
        return cb(err);
      }

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

  connection.setupStorageOnly((err) => {
    if (err) return callback(err);

    async.parallel([mongoIndices, elasticIndices], callback);
  });
};

/**
 * @description Return prefix of the URL that assets are served under.
 */
HybridStorage.prototype.assetURLPrefix = function () {
  return config.memoryAssetPrefix();
};

HybridStorage.prototype.assetPublicURL = function (filename) {
  return this.assetURLPrefix() + encodeURIComponent(filename);
};

HybridStorage.prototype.storeAsset = function (stream, filename, contentType, callback) {
  getRawBody(stream, (err, body) => {
    if (err) return callback(err);

    this.assets[filename] = { contentType, body };
    const publicURL = this.assetPublicURL(filename);

    callback(null, publicURL);
  });
};

HybridStorage.prototype.bulkStoreAssets = function (stream, callback) {
  const publicURLs = {};

  const extract = tar.extract();

  extract.on('entry', (header, stream, next) => {
    if (header.type !== 'file') return next();

    this.storeAsset(stream, header.name, '', (err, publicURL) => {
      if (err) return;

      publicURLs[header.name] = publicURL;
      next();
    });
  });

  extract.on('finish', () => callback(null, publicURLs));

  stream.pipe(zlib.createGunzip()).pipe(extract);
};

HybridStorage.prototype.nameAsset = function (name, publicURL, callback) {
  this.namedAssets[name] = { key: name, publicURL };

  callback(null);
};

HybridStorage.prototype.findNamedAssets = function (callback) {
  callback(null, _.values(this.namedAssets));
};

HybridStorage.prototype.assetExists = function (filename, callback) {
  process.nextTick(() => callback(null, this.assets[filename] !== undefined));
};

HybridStorage.prototype.getAsset = function (filename, callback) {
  var asset = this.assets[filename];

  if (asset === undefined) {
    var err = new Error('Memory storage error');

    err.statusCode = 404;
    err.responseBody = 'Oh snap';

    return callback(err);
  }

  callback(null, asset);
};

function mongoCollection (name) {
  return connection.mongo.collection(config.mongodbPrefix() + name);
}
