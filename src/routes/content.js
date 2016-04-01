'use strict';
// Store, retrieve, and delete metadata envelopes.

const url = require('url');
const async = require('async');
const request = require('request');
const urljoin = require('urljoin');
const targz = require('tar.gz');
const storage = require('../storage');
const config = require('../config');
const log = require('../logging').getLogger();

/**
 * @description Store new content into the content service.
 */
exports.store = function (req, res, next) {
  var reqStart = Date.now();
  var contentID = req.params.id;
  var envelope = req.body;

  log.debug({
    action: 'contentstore',
    apikeyName: req.apikeyName,
    contentID: contentID,
    message: 'Content storage request received.'
  });

  // Store the envelope in the primary key-value storage engine.
  var kvStore = function (cb) {
    storage.storeContent(contentID, envelope, cb);
  };

  // Index the envelope in the full text search storage engine.
  var ftsStore = function (cb) {
    storage.indexContent(contentID, envelope, cb);
  };

  async.parallel([
    kvStore,
    ftsStore
  ], function (err) {
    if (err) {
      log.error({
        action: 'contentstore',
        statusCode: err.statusCode || 500,
        apikeyName: req.apikeyName,
        contentID: req.params.id,
        error: err.message,
        stack: err.stack,
        totalReqDuration: Date.now() - reqStart,
        message: 'Unable to store content.'
      });

      return next(err);
    }

    res.send(204);

    log.info({
      action: 'contentstore',
      statusCode: 204,
      apikeyName: req.apikeyName,
      contentID: contentID,
      totalReqDuration: Date.now() - reqStart,
      message: 'Content storage successful.'
    });

    next();
  });
};

/**
 * @description Store new content into the content store from an uploaded tarball.
 */
exports.bulk = function (req, res, next) {
  const parse = targz().createParseStream();

  parse.on('entry', (entry) => {
    if (entry.type !== 'File') return;

    log.debug('Received entry for path', { path: entry.path });
  });

  parse.on('error', (err) => {
    log.info('Corrupted tarball uploaded', {
      err: err.message,
      stack: err.stack
    });

    res.send(400, err);

    next();
  });

  parse.on('end', () => {
    log.debug('Tarball completed.');

    res.send(204);
    next();
  });

  req.pipe(parse);
};

/**
 * @description Retrieve content from the store by content ID. If PROXY_UPSTREAM is set, make a
 * request to the configured upstream content service's API.
 */
exports.retrieve = function (req, res, next) {
  let reqStart = Date.now();
  let contentID = req.params.id;

  log.debug({
    action: 'contentretrieve',
    startTs: reqStart,
    contentID: contentID,
    message: 'Content ID request received.'
  });

  let doc = { envelope: {} };

  let downloadContent = (callback) => {
    storage.getContent(contentID, (err, envelope) => {
      if (err) {
        // If content is not found and a proxy server is configured, send a proxy request instead.
        if (err.statusCode && err.statusCode === 404 && config.proxyUpstream()) {
          return downloadUpstreamContent(callback);
        }

        return callback(err);
      }

      doc = { envelope };
      callback(null);
    });
  };

  let downloadUpstreamContent = (callback) => {
    let upstreamContentID = config.stagingMode() ? removeRevisionID(contentID) : contentID;
    let url = urljoin(config.proxyUpstream(), 'content', encodeURIComponent(upstreamContentID));

    log.debug({
      action: 'contentretrieve',
      contentID,
      upstreamContentID,
      upstreamURL: url,
      message: 'Making upstream content request.'
    });

    request({ url, json: true }, (err, response, body) => {
      if (err) return callback(err);

      if (response.statusCode === 404) {
        log.debug({
          action: 'contentretrieve',
          contentID,
          upstreamContentID,
          upstreamURL: url,
          message: 'Content not found in upstream.'
        });

        let err = new Error('Content not found');
        err.statusCode = 404;
        err.responseBody = response.body;

        return callback(err);
      }

      if (response.statusCode !== 200) {
        log.error({
          action: 'contentretrieve',
          contentID,
          upstreamContentID,
          upstreamURL: url,
          statusCode: response.statusCode,
          message: 'Upstream content request error'
        });

        let err = new Error('Upstream proxy error');
        err.statusCode = 502;
        err.responseBody = response.body;

        return callback(err);
      }

      log.debug({
        action: 'contentretrieve',
        contentID,
        upstreamContentID,
        upstreamURL: url,
        message: 'Upstream content request successful.'
      });

      doc = body;
      callback(null);
    });
  };

  downloadContent((err) => {
    if (err) {
      var message = 'Unable to retrieve content.';
      if (err.statusCode && err.statusCode === 404) {
        message = `No content for ID [${contentID}]`;
        delete err.stack;
      }

      log.error({
        action: 'contentretrieve',
        statusCode: err.statusCode || 500,
        contentID: req.params.id,
        error: err.message,
        stack: err.stack,
        message: message
      });

      return next(err);
    }

    res.json(doc);

    log.info({
      action: 'contentretrieve',
      statusCode: 200,
      contentID,
      totalReqDuration: Date.now() - reqStart,
      message: 'Content request successful.'
    });

    next();
  });
};

/**
 * @description Delete a piece of previously stored content by content ID.
 */
exports.delete = function (req, res, next) {
  var contentID = req.params.id;
  log.debug('Content deletion request received.', {
    action: 'content delete',
    apikeyName: req.apikeyName,
    contentID: contentID
  });

  var reqStart = Date.now();

  var kvDelete = function (cb) {
    storage.deleteContent(contentID, cb);
  };

  var ftsDelete = function (cb) {
    storage.unindexContent(contentID, cb);
  };

  async.parallel([
    kvDelete,
    ftsDelete
  ], function (err) {
    if (err) {
      err.statusCode = err.statusCode || err.status || 500;

      log.error('Unable to delete content.', {
        event: 'content delete',
        statusCode: err.statusCode,
        errMessage: err.message,
        apikeyName: req.apikeyName,
        contentID: contentID,
        totalReqDuration: Date.now() - reqStart
      });

      return next(err);
    }

    res.send(204);

    log.info('Content deletion successful.', {
      event: 'content delete',
      statusCode: 204,
      apikeyName: req.apikeyName,
      contentID: contentID,
      totalReqDuration: Date.now() - reqStart
    });

    next();
  });
};

// Remove the revision ID from the first path segment of the contentID.
let removeRevisionID = function (contentID) {
  let asURL = url.parse(contentID);

  let pathSegments = asURL.pathname.split('/');
  pathSegments.splice(1, 1);
  asURL.pathname = pathSegments.join('/');

  return url.format(asURL);
};
