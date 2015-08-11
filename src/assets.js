// Handler functions for the /assets endpoint.

var async = require('async');
var pkgcloud = require('pkgcloud');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var restify = require('restify');
var config = require('./config');
var storage = require('./storage');
var log = require('./logging').getLogger();

/**
 * @description Calculate a checksum of an uploaded file's contents to generate
 *   the fingerprinted asset name.
 */
function fingerprintAsset(asset, callback) {
  var sha256sum = crypto.createHash('sha256');
  var assetFile = fs.createReadStream(asset.path);
  var chunks = [];

  assetFile.on('data', function(chunk) {
    sha256sum.update(chunk);
    chunks.push(chunk);
  });

  assetFile.on('error', callback);

  assetFile.on('end', function() {
    var digest = sha256sum.digest('hex');
    var ext = path.extname(asset.name);
    var basename = path.basename(asset.name, ext);
    var fingerprinted = basename + "-" + digest + ext;

    log.debug({
      action: 'assetstore',
      originalAssetName: asset.name,
      assetFilename: fingerprinted,
      message: "Asset fingerprinted successfully."
    });

    callback(null, {
      key: asset.key,
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
function publishAsset(asset, callback) {
  storage.uploadAsset(asset, function(err, asset) {
    if (err) {
      return callback(err);
    }

    log.debug({
      action: 'assetstore',
      assetFilename: asset.filename,
      message: "Asset uploaded successfully."
    });

    callback(null, asset);
  });
}

/**
 * @description Give this asset a name. The final name and CDL URI of this
 *   asset will be included in all outgoing metadata envelopes, for use by
 *   layouts.
 */
function nameAsset(asset, callback) {
  storage.nameAsset(asset, function(err, asset) {
    if (err) {
      return callback(err);
    }

    log.debug({
      action: 'assetstore',
      originalAssetFilename: asset.original,
      assetName: asset.key,
      message: "Asset named successfully."
    });

    callback(null, asset);
  });
}

/**
 * @description Create and return a function that processes a single asset.
 */
function makeAssetHandler(shouldName) {
  return function(asset, callback) {
    log.debug({
      action: 'assetstore',
      originalAssetName: asset.name,
      message: "Asset upload request received."
    });

    var steps = [
      async.apply(fingerprintAsset, asset),
      publishAsset
    ];

    if (shouldName) {
      steps.push(nameAsset);
    }

    async.waterfall(steps, callback);
  };
}

/**
 * @description Enumerate all named assets.
 */
var enumerateNamed = exports.enumerateNamed = function(callback) {
  storage.enumerateNamedAssets(function(err, assetVars) {
    if (err) {
      return callback(err);
    }

    var assets = {};

    for (i = 0; i < assetVars.length; i++) {
      var assetVar = assetVars[i];
      assets[assetVar.key] = assetVar.publicURL;
    }

    callback(null, assets);
  });
};

/**
 * @description Append a list of asset names to a message before it's logged.
 */
function withAssetList(message, originalAssetNames) {
  var subset = originalAssetNames.slice(0, 3);

  if (originalAssetNames.length > 3) {
    subset.push("..");
  }

  var joined = subset.join(", ");

  return message + ": " + joined + ".";
}

/**
 * @description Fingerprint and upload static, binary assets to the
 *   CDN-enabled ASSET_CONTAINER. Return a JSON object containing a
 *   map of the provided filenames to their final, public URLs.
 */
exports.accept = function(req, res, next) {
  var originalAssetNames = [];
  var assetData = Object.getOwnPropertyNames(req.files).map(function(key) {
    var asset = req.files[key];
    asset.key = key;
    originalAssetNames.push(key);
    return asset;
  });

  log.debug({
    action: 'assetstore',
    apikeyName: req.apikeyName,
    assetCount: assetData.length,
    originalAssetNames: originalAssetNames,
    message: withAssetList("Asset upload request received", originalAssetNames),
  });

  var reqStart = Date.now();

  async.map(assetData, makeAssetHandler(req.query.named), function(err, results) {
    if (err) {
      var statusCode = err.statusCode || 500;

      log.error({
        action: 'assetstore',
        statusCode: statusCode,
        apikeyName: req.apikeyName,
        error: err.message,
        stack: err.stack,
        message: withAssetList("Unable to upload one or more assets", originalAssetNames)
      });

      res.send(statusCode, {
        apikeyName: req.apikeyName,
        error: "Unable to upload one or more assets."
      });

      return next(err);
    }

    var summary = {};
    results.forEach(function(result) {
      summary[result.original] = result.publicURL;
    });
    log.info({
      action: 'assetstore',
      statusCode: 200,
      apikeyName: req.apikeyName,
      totalReqDuration: Date.now() - reqStart,
      message: withAssetList("All assets have been uploaded successfully", originalAssetNames)
    });

    res.send(summary);
    next();
  });
};

exports.list = function(req, res, next) {
  log.debug("Asset list requested.");

  enumerateNamed(function(err, assets) {
    if (err) {
      log.error({
        action: 'assetlist',
        statusCode: err.statusCode || 500,
        message: "Unable to list assets.",
        error: err.message,
        stack: err.stack
      });
      return next(err);
    }

    res.send(assets);
    next();
  });
};
