// Store, retrieve, and delete metadata envelopes.

var
  async = require('async'),
  _ = require('lodash'),
  config = require('./config'),
  connection = require('./connection'),
  log = require('./logging').getLogger();

/**
 * @description Download the raw metadata envelope from Cloud Files.
 */
function downloadContent(contentID, callback) {
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

  source.on('end', function () {
    var
      complete = Buffer.concat(chunks),
      envelope = JSON.parse(complete);

    callback(null, {envelope: envelope});
  });
}

/**
 * @description Inject asset variables included from the /assets endpoint into
 *   an outgoing metadata envelope.
 */
function injectAssetVars(doc, callback) {
  log.debug("Collecting asset variables to inject into the envelope.");

  connection.db.collection("layoutAssets").find().toArray(function (err, assetVars) {
    if (err) {
      callback(err);
      return;
    }

    log.debug("Injecting " + assetVars.length + " variables into the envelope.");

    var assets = {};

    for (i = 0; i < assetVars.length; i++) {
      var assetVar = assetVars[i];
      assets[assetVar] = assetVar.publicURL;
    }

    doc.assets = assets;

    callback(null, doc);
  });
}

/**
 * @description If the envelope contains a "query" attribute, perform each query and inject the
 *   results into the document.
 */
function handleQueries(doc, callback) {
  if (!doc.envelope.queries) {
    log.debug("No queries present in metadata envelope.");
    return callback(null, doc);
  }

  var queryNames = _.keys(doc.envelope.queries);
  var queries = [];
  for (var i = 0; i < queryNames.length; i++) {
    queries.push(doc.envelope.queries[queryNames[i]]);
  }

  delete doc.envelope.queries;

  log.debug("Processing " + queries.length + " envelope queries.");

  async.map(
    queries,
    function (query, callback) {
      var
        order = query.$order || { publish_date: -1 },
        skip = query.$skip,
        limit = query.$limit;

      if (query.$query) {
        query = query.$query;
        delete query.$query;
      }
      delete query.$skip;
      delete query.$limit;

      var cursor = connection.db.collection("envelopes").find(query);

      cursor.sort(order);
      if (skip) { cursor.skip(skip); }
      if (limit) { cursor.limit(limit); }

      cursor.toArray(callback);
    },
    function (err, results) {
      if (err) return callback(err);

      doc.results = {};
      for (var i = 0; i < results.length; i++) {
        doc.results[queryNames[i]] = results[i];
      }

      callback(null, doc);
  });
}

/**
 * @description Store an incoming metadata envelope within Cloud Files.
 */
function storeEnvelope(doc, callback) {
  var dest = connection.client.upload({
    container: config.contentContainer(),
    remote: encodeURIComponent(doc.contentID)
  });

  dest.end(JSON.stringify(doc.envelope), function (err) {
    if (err) return callback(err);

    callback(null, doc);
  });
}

/**
 * @description Persist selected attributes from a metadata envelope in an indexed Mongo collection.
 */
function indexEnvelope(doc, callback) {
  var subdoc = _.pick(doc.envelope, ["title", "publish_date", "tags", "categories"]);

  subdoc.contentID = doc.contentID;

  connection.db.collection("envelopes").findOneAndReplace(
    { contentID: subdoc.contentID },
    subdoc,
    { upsert: true },
    function (err) {
      if (err) return callback(err);
      callback(null, doc);
    }
  );
}

/**
 * @description Retrieve content from the store by content ID.
 */
exports.retrieve = function (req, res, next) {
  log.debug("Requesting content ID: [" + req.params.id + "]");

  async.waterfall([
    async.apply(downloadContent, req.params.id),
    injectAssetVars,
    handleQueries
  ], function (err, doc) {
    next.ifError(err);

    res.json(doc);
    next();
  });
};

/**
 * @description Store new content into the content service.
 */
exports.store = function (req, res, next) {
  log.info("(" + req.apikeyName + ") Storing content with ID: [" + req.params.id + "]");

  var doc = {
    contentID: req.params.id,
    envelope: req.body
  };

  async.waterfall([
    async.apply(storeEnvelope, doc),
    indexEnvelope
  ], function (err, doc) {
    next.ifError(err);

    res.send(204);
    next();
  });
};

/**
 * @description Delete a piece of previously stored content by content ID.
 */
exports.delete = function (req, res, next) {
  log.info("(" + req.apikeyName + ") Deleting content with ID [" + req.params.id + "]");

  connection.client.removeFile(config.contentContainer(), encodeURIComponent(req.params.id), function (err) {
    next.ifError(err);

    res.send(204);
    next();
  });
};
