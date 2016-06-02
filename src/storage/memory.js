'use strict';

const zlib = require('zlib');
const _ = require('lodash');
const async = require('async');
const getRawBody = require('raw-body');
const tar = require('tar-stream');

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

MemoryStorage.prototype.assetPublicURL = function (filename) {
  return this.assetURLPrefix() + encodeURIComponent(filename);
};

MemoryStorage.prototype.storeAsset = function (stream, filename, contentType, callback) {
  getRawBody(stream, (err, body) => {
    if (err) return callback(err);

    this.assets[filename] = { contentType, body };
    const publicURL = this.assetPublicURL(filename);

    callback(null, publicURL);
  });
};

MemoryStorage.prototype.bulkStoreAssets = function (stream, callback) {
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

MemoryStorage.prototype.nameAsset = function (name, publicURL, callback) {
  this.namedAssets[name] = { key: name, publicURL };

  callback(null);
};

MemoryStorage.prototype.findNamedAssets = function (callback) {
  callback(null, _.values(this.namedAssets));
};

MemoryStorage.prototype.assetExists = function (filename, callback) {
  process.nextTick(() => callback(null, this.assets[filename] !== undefined));
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

MemoryStorage.prototype._storeEnvelope = function (contentID, content, callback) {
  this.envelopes[contentID] = content;
  callback();
};

MemoryStorage.prototype._getEnvelope = function (contentID, callback) {
  var envelope = this.envelopes[contentID];

  if (envelope === undefined) {
    var err = new Error('Memory storage error');

    err.statusCode = 404;
    err.responseBody = 'Oh snap';

    return callback(err);
  }

  callback(null, envelope);
};

MemoryStorage.prototype.deleteEnvelope = function (contentID, callback) {
  delete this.envelopes[contentID];

  callback();
};

MemoryStorage.prototype.bulkDeleteEnvelopes = function (contentIDs, callback) {
  async.each(contentIDs, (id, cb) => this.deleteEnvelope(id, cb), callback);
};

MemoryStorage.prototype.envelopesExist = function (contentIDMap, callback) {
  const results = {};

  for (let contentID in contentIDMap) {
    if (contentIDMap.hasOwnProperty(contentID)) {
      const envelope = this.envelopes[contentID];

      if (!envelope) {
        results[contentID] = {
          present: false,
          matches: false
        };
      } else {
        results[contentID] = {
          present: true,
          matches: envelope.fingerprint === contentIDMap[contentID]
        };
      }
    }
  }

  process.nextTick(() => callback(null, results));
};

MemoryStorage.prototype.listEnvelopes = function (options, eachCallback, endCallback) {
  var ids = Object.keys(this.envelopes);

  if (options.prefix) {
    ids = ids.filter((id) => id.startsWith(options.prefix));
  }

  ids.forEach((id) => eachCallback(this.envelopes[id]));

  endCallback(null);
};

MemoryStorage.prototype.countEnvelopes = function (options, callback) {
  let ids = Object.keys(this.envelopes);

  if (options.prefix) {
    ids = ids.filter((id) => id.startsWith(options.prefix));
  }

  process.nextTick(() => callback(null, ids.length));
};

MemoryStorage.prototype.createNewIndex = function (indexName, callback) {
  callback();
};

MemoryStorage.prototype._indexEnvelope = function (contentID, envelope, indexName, callback) {
  this.indexedEnvelopes.push({
    _id: contentID,
    _source: envelope
  });

  callback();
};

MemoryStorage.prototype.makeIndexActive = function (indexName, callback) {
  callback();
};

MemoryStorage.prototype.queryEnvelopes = function (query, categories, pageNumber, perPage, callback) {
  var rx = new RegExp(query, 'i');

  var hits = this.indexedEnvelopes.filter(function (entry) {
    if (categories) {
      if (_.intersection(categories, entry._source.categories).length === 0) {
        return false;
      }
    }

    return rx.test([entry._source.title, entry._source.body, entry._source.keywords].join(' '));
  }).map(function (entry) {
    // Populate "highlights" as just the regexp matches, surrounded by <em> tags.
    var m = rx.exec(entry._source.body);

    if (m !== null) {
      var highlight = [`...<em>${m[0]}</em>...`];
      entry.highlight = {body: highlight};
    }

    return entry;
  });

  // Mimic the important parts of the Elasticsearch response.
  callback(null, {
    hits: {
      total: hits.length,
      hits: hits
    }
  });
};

MemoryStorage.prototype.unindexEnvelope = function (contentID, callback) {
  this.indexedEnvelopes = this.indexedEnvelopes.filter(function (each) {
    return each._id !== contentID;
  });

  callback(null);
};

MemoryStorage.prototype.bulkUnindexEnvelopes = function (contentIDs, callback) {
  async.each(contentIDs, (id, cb) => this.unindexEnvelope(id, cb), callback);
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
