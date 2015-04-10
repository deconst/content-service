// Store, retrieve, and delete metadata envelopes.

var
  async = require('async'),
  config = require('./config'),
  connection = require('./connection'),
  logging = require('./logging');

var log = logging.getLogger(config.content_log_level());

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

    callback(null, envelope);
  });
}

/**
 * @description Inject asset variables included from the /assets endpoint into
 *   an outgoing metadata envelope.
 */
function inject_asset_vars(envelope, callback) {
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

    envelope.assets = assets;

    callback(null, envelope);
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
  ], function (err, envelope) {
    if (err) {
      log.error("Failed to retrieve a metadata envelope", err);

      res.status(err.statusCode || 500);
      res.send();
      next();

      return;
    }

    res.status(200);
    res.json(envelope);
    next();
  });
};

/**
 * @description Store new content into the content service.
 */
exports.store = function (req, res, next) {
  log.info("Storing content with ID: [" + req.params.id + "]");

  var dest = connection.client.upload({
    container: config.content_container(),
    remote: encodeURIComponent(req.params.id)
  });

  dest.on('success', function () {
    res.status(200);
    res.send();
    next();
  });

  // For now, we're just going to write the body directly up to Cloud Files.
  // Longer term, we'll validate its structure and use async.parallel to upload it to different stores.
  req.pipe(dest);
};

/**
 * @description Delete a piece of previously stored content by content ID.
 */
exports.delete = function (req, res, next) {
  log.info("Deleting content with ID [" + req.params.id + "]");

  connection.client.removeFile(config.content_container(), encodeURIComponent(req.params.id), function (err) {
    if (err) {
      res.status(err.statusCode);
      res.send();
      next();
      return;
    }

    res.status(200);
    res.send();
    next();
  });
};
