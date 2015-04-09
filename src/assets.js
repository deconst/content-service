// Handler functions for the /assets endpoint.

var
  async = require('async'),
  pkgcloud = require('pkgcloud'),
  fs = require('fs'),
  path = require('path'),
  crypto = require('crypto'),
  config = require('./config'),
  connection = require('./connection'),
  logging = require('./logging');

var log = logging.getLogger(config.content_log_level());
var base_uri = connection.asset_container.cdnSslUri;

/**
 * @description Calculate a checksum of an uploaded file's contents to generate
 *   the fingerprinted asset name.
 */
function fingerprint_asset(asset, callback) {
  var
    sha256sum = crypto.createHash('sha256'),
    asset_file = fs.createReadStream(asset.path),
    chunks = [];

  asset_file.on('data', function (chunk) {
    sha256sum.update(chunk);
    chunks.push(chunk);
  });

  asset_file.on('error', callback);

  asset_file.on('end', function() {
    var
      digest = sha256sum.digest('hex'),
      ext = path.extname(asset.name),
      basename = path.basename(asset.name, ext),
      fingerprinted = basename + "-" + digest + ext;

    log.debug("Fingerprinted asset [" + asset.name + "] as [" + fingerprinted + "].");

    callback(null, {
      original: asset.name,
      chunks: chunks,
      filename: fingerprinted,
      type: asset.type,
    });
  });
}

/**
 * @description Upload an asset's contents to the asset container.
 */
function publish_asset(asset, callback) {
  var up = connection.client.upload({
    container: config.asset_container(),
    remote: asset.filename,
    contentType: asset.type,
    headers: { 'Access-Control-Allow-Origin': '*' }
  });

  up.on('error', callback);

  up.on('finish', function () {
    log.debug("Successfully uploaded asset [" + asset.filename + "].");

    asset.public_url = base_uri + '/' + encodeURIComponent(asset.filename);
    callback(null, asset);
  });

  asset.chunks.forEach(function (chunk) {
    up.write(chunk);
  });

  up.end();
}

/**
 * @description Give this asset a name. The final name and CDL URI of this
 *   asset will be included in all outgoing metadata envelopes, for use by
 *   layouts.
 */
function name_asset(name, asset, callback) {
  log.debug("Naming asset [" + asset.name + "].");

  connection.db.collection("layout_assets").updateOne(
    { name: asset.name },
    { $set: { name: asset.name, public_url: asset.public_url } },
    { upsert: true },
    function (err) { callback(err, asset); }
  );
}

/**
 * @description Process a single asset.
 */
function handle_asset(name, asset, callback) {
  log.debug("Processing uploaded asset [" + asset.name + "].");

  var steps = [
    async.apply(fingerprint_asset, asset),
    publish_asset
  ];

  if (name) {
    steps.push(async.apply(name_asset, name));
  }

  async.waterfall(steps, callback);
}

/**
 * @description Fingerprint and upload static, binary assets to the
 *   CDN-enabled ASSET_CONTAINER. Return a JSON object containing a
 *   map of the provided filenames to their final, public URLs.
 */
exports.accept = function (req, res, next) {
  var asset_data = Object.getOwnPropertyNames(req.files).map(function (key) {
    return req.files[key];
  });

  async.map(asset_data, async.apply(handle_asset, req.query.name), function (err, results) {
    if (err) {
      log.error("Unable to process an asset.", err);

      res.status(500);
      res.send({
        error: "Unable to upload one or more assets!"
      });
      next();
    }

    var summary = {};
    results.forEach(function (result) {
      summary[result.original] = result.public_url;
    });
    log.debug("All assets have been processed succesfully.", summary);

    res.status(200);
    res.send(summary);
    next();
  });
};
