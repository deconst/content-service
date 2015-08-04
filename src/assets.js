// Handler functions for the /assets endpoint.

var
    async = require('async'),
    pkgcloud = require('pkgcloud'),
    fs = require('fs'),
    path = require('path'),
    crypto = require('crypto'),
    config = require('./config'),
    connection = require('./connection'),
    log = require('./logging').getLogger();

/**
 * @description Calculate a checksum of an uploaded file's contents to generate
 *   the fingerprinted asset name.
 */
function fingerprintAsset(asset, callback) {
    var sha256sum = crypto.createHash('sha256');
    var assetFile = fs.createReadStream(asset.path);
    var chunks = [];

    assetFile.on('data', function (chunk) {
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
    var up = connection.client.upload({
        container: config.assetContainer(),
        remote: asset.filename,
        contentType: asset.type,
        headers: { 'Access-Control-Allow-Origin': '*' }
    });

    up.on('error', callback);

    up.on('success', function () {
        log.debug({
            action: 'assetstore',
            assetFilename: asset.filename,
            message: "Asset uploaded successfully."
        });

        var baseURI = connection.assetContainer.cdnSslUri;
        asset.publicURL = baseURI + '/' + encodeURIComponent(asset.filename);
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
function nameAsset(asset, callback) {
    log.debug({
        action: 'assetstore',
        originalAssetFilename: asset.original,
        assetName: asset.key,
        message: "Asset named successfully."
    });

    connection.db.collection("layoutAssets").updateOne(
        { key: asset.key },
        { $set: { key: asset.key, publicURL: asset.publicURL } },
        { upsert: true },
        function (err) { callback(err, asset); }
    );
}

/**
 * @description Create and return a function that processes a single asset.
 */
function makeAssetHandler(should_name) {
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

        if (should_name) {
            steps.push(nameAsset);
        }

        async.waterfall(steps, callback);
    };
}

/**
 * @description Enumerate all named assets.
 */
var enumerateNamed = exports.enumerateNamed = function (callback) {
    connection.db.collection("layoutAssets").find().toArray(function (err, assetVars) {
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
 * @description Fingerprint and upload static, binary assets to the
 *   CDN-enabled ASSET_CONTAINER. Return a JSON object containing a
 *   map of the provided filenames to their final, public URLs.
 */
exports.accept = function (req, res, next) {
    var assetData = Object.getOwnPropertyNames(req.files).map(function (key) {
        var asset = req.files[key];
        asset.key = key;
        return asset;
    });

    log.debug({
        action: 'assetstore',
        apikeyName: req.apikeyName,
        assetCount: assetData.length,
        message: "Asset upload request received."
    });

    var reqStart = Date.now();

    async.map(assetData, makeAssetHandler(req.query.named), function (err, results) {
        if (err) {
            var statusCode = err.statusCode || 500;

            log.error({
                action: 'assetstore',
                statusCode: statusCode,
                apikeyName: req.apikeyName,
                error: err.message,
                message: "Unable to upload one or more assets."
            });

            res.send(statusCode, {
                apikeyName: req.apikeyName,
                error: "Unable to upload one or more assets."
            });

            return next(err);
        }

        var summary = {};
        results.forEach(function (result) {
            summary[result.original] = result.publicURL;
        });
        log.info({
            action: 'assetstore',
            statusCode: 200,
            apikeyName: req.apikeyName,
            totalReqDuration: Date.now() - reqStart,
            message: "All assets have been uploaded successfully."
        });

        res.send(summary);
        next();
    });
};

exports.list = function (req, res, next) {
    log.debug("Asset list requested.");

    enumerateNamed(function (err, assets) {
        if (err) {
            log.error({
                action: 'assetlist',
                statusCode: err.statusCode || 500,
                message: "Unable to list assets.",
                error: err.message
            });
            return next(err);
        }

        res.send(assets);
        next();
    });
};
