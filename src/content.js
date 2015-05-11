// Store, retrieve, and delete metadata envelopes.

var
  async = require('async'),
  _ = require('lodash'),
  config = require('./config'),
  connection = require('./connection'),
  log = require('./logging').logger;

/**
 * @description Download the raw metadata envelope from Cloud Files.
 */
function download_content(content_id, callback) {
  var source = connection.client.download({
    container: config.content_container(),
    remote: encodeURIComponent(content_id)
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
function inject_asset_vars(doc, callback) {
  log.debug("Collecting asset variables to inject into the envelope.");

  connection.db.collection("layout_assets").find().toArray(function (err, asset_vars) {
    if (err) {
      callback(err);
      return;
    }

    log.debug("Injecting " + asset_vars.length + " variables into the envelope.");

    var assets = {};

    asset_vars.forEach(function (asset_var) {
      assets[asset_var.key] = asset_var.public_url;
    });

    doc.assets = assets;

    callback(null, doc);
  });
}

/**
 * @description Store an incoming metadata envelope within Cloud Files.
 */
function store_envelope(doc, callback) {
  var dest = connection.client.upload({
    container: config.content_container(),
    remote: encodeURIComponent(doc.content_id)
  });

  dest.end(JSON.stringify(doc.envelope), function (err) {
    if (err) return callback(err);

    callback(null, doc);
  });
}

/**
 * @description Persist selected attributes from a metadata envelope in an indexed Mongo collection.
 */
function index_envelope(doc, callback) {
  var subdoc = _.pick(doc.envelope, ["title", "publish_date", "tags", "categories"]);

  subdoc.content_id = doc.content_id;

  connection.db.collection("envelopes").insertOne(subdoc, function (err, db) {
    if (err) return callback(err);
    callback(null, doc);
  });
}

/**
 * @description Retrieve content from the store by content ID.
 */
exports.retrieve = function (req, res, next) {
  log.debug("Requesting content ID: [" + req.params.id + "]");

  async.waterfall([
    async.apply(download_content, req.params.id),
    inject_asset_vars
  ], function (err, doc) {
    if (err) {
      log.error("Failed to retrieve a metadata envelope", err);

      res.status(err.statusCode || 500);
      res.send();
      next();

      return;
    }

    res.json(doc);
    next();
  });
};

/**
 * @description Store new content into the content service.
 */
exports.store = function (req, res, next) {
  log.info("(" + req.apikey_name + ") Storing content with ID: [" + req.params.id + "]");

  var doc = {
    content_id: req.params.id,
    envelope: req.body
  };

  async.waterfall([
    async.apply(store_envelope, doc),
    index_envelope
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
  log.info("(" + req.apikey_name + ") Deleting content with ID [" + req.params.id + "]");

  connection.client.removeFile(config.content_container(), encodeURIComponent(req.params.id), function (err) {
    if (err) {
      res.status(err.statusCode);
      res.send();
      return next();
    }

    res.send(204);
    next();
  });
};
