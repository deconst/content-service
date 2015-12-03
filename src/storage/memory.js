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

MemoryStorage.prototype._storeContent = function (contentID, content, callback) {
  this.envelopes[contentID] = content;
  callback();
};

MemoryStorage.prototype._getContent = function (contentID, callback) {
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
  var ids = Object.keys(this.envelopes);

  callback(null, ids, function () {
    if (ids.length > 0) {
      callback(null, [], function () {});
    }
  });
};

MemoryStorage.prototype._indexContent = function (contentID, envelope, callback) {
  this.indexedEnvelopes.push({
    _id: contentID,
    _source: envelope
  });

  callback();
};

MemoryStorage.prototype.queryContent = function (query, pageNumber, perPage, callback) {
  var rx = new RegExp(query, 'i');

  var hits = this.indexedEnvelopes.filter(function (entry) {
    return rx.test([entry._source.title, entry._source.body, entry._source.keywords].join(' '));
  }).map(function (entry) {
    // Populate "highlights" as just the regexp matches, surrounded by <em> tags.
    var m = rx.exec(entry._source.body);
    var highlight = [];

    if (m !== null) {
      highlight.push('...<em>' + entry._source.body.substr(m.index, m[0].length) + '</em>...');
    }

    entry.highlight = {body: highlight};
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

MemoryStorage.prototype.unindexContent = function (contentID, callback) {
  this.indexedEnvelopes = this.indexedEnvelopes.filter(function (each) {
    return each._id !== contentID;
  });

  callback(null);
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
