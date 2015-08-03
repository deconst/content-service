// Store, retrieve, and delete metadata envelopes.

var
    async = require('async'),
    _ = require('lodash'),
    restify = require('restify'),
    config = require('./config'),
    connection = require('./connection'),
    log = require('./logging').getLogger();
    assets = require('./assets');

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

    source.on('complete', function (resp) {
        if (resp.statusCode === 404) {
            log.warn("No content for ID [" + contentID + "]");

            return callback(new restify.NotFoundError("No content for ID [" + contentID + "]"));
        }

        if (resp.statusCode > 400) {
            log.warn("Cloud files error.", resp);

            return callback(
                new restify.InternalServerError("Error communicating with an upstream service."));
            }

            var complete = Buffer.concat(chunks);
            var envelope = JSON.parse(complete);

            callback(null, {envelope: envelope});
        });
}

/**
 * @description Inject asset variables included from the /assets endpoint into
 *   an outgoing metadata envelope.
 */
function injectAssetVars(doc, callback) {
    assets.list(function (err, assets) {
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

    async.map(queries, handleQuery, function (err, results) {
        if (err) return callback(err);

        doc.results = {};
        for (var i = 0; i < results.length; i++) {
            for (var j = 0; j < results[i].length; j++) {
                var each = results[i][j];

                if (each.publish_date) {
                    var d = new Date();
                    d.setTime(each.publish_date);
                    each.publish_date = d.toUTCString();
                }
            }

            doc.results[queryNames[i]] = results[i];
        }

        callback(null, doc);
    });
}

/**
 * @description Perform a single metadata envelope related-document query.
 */
function handleQuery(query, callback) {
    var order = query.$order || { publish_date: -1 };
    var skip = query.$skip;
    var limit = query.$limit;

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
    var subdoc = _.pick(doc.envelope, ["title", "tags", "categories"]);

    subdoc.contentID = doc.contentID;
    if (doc.envelope.publish_date) {
        var parsed_date = Date.parse(doc.envelope.publish_date);
        if (! Number.isNaN(parsed_date)) {
            subdoc.publish_date = parsed_date;
        }
    }

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
    log.debug({
        apiKeyName: req.apikeyName,
        contentID: req.params.id,
        message: "Content storage request received."
    });

    var reqStart = Date.now();

    var doc = {
        contentID: req.params.id,
        envelope: req.body
    };

    async.waterfall([
        async.apply(storeEnvelope, doc),
        indexEnvelope
    ], function (err, doc) {
        if (err) {
            log.error({
                apiKeyName: req.apikeyName,
                contentID: req.params.id,
                error: err.message,
                totalReqDuration: Date.now() - reqStart,
                message: "Unable to store content."
            });

            next(err);
        }

        res.send(204);

        log.info({
            apiKeyName: req.apikeyName,
            contentID: req.params.id,
            totalReqDuration: Date.now() - reqStart,
            message: "Content storage successful."
        });

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
