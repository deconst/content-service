'use strict';

const url = require('url');
const request = require('request');
const urljoin = require('urljoin');
const storage = require('../../storage');
const config = require('../../config');
const logger = require('../../logging').getLogger();

/**
 * @description Retrieve content from the store by content ID. If PROXY_UPSTREAM is set, make a
 * request to the configured upstream content service's API.
 */
exports.handler = function (req, res, next) {
  let reqStart = Date.now();
  let contentID = req.params.id;

  logger.debug({
    action: 'contentretrieve',
    startTs: reqStart,
    contentID: contentID,
    message: 'Content ID request received.'
  });

  let doc = { envelope: {} };

  let downloadContent = (callback) => {
    storage.getEnvelope(contentID, (err, envelope) => {
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

    logger.debug({
      action: 'contentretrieve',
      contentID,
      upstreamContentID,
      upstreamURL: url,
      message: 'Making upstream content request.'
    });

    request({ url, json: true }, (err, response, body) => {
      if (err) return callback(err);

      if (response.statusCode === 404) {
        logger.debug({
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
        logger.error({
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

      logger.debug({
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

      logger.error({
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

    logger.info({
      action: 'contentretrieve',
      statusCode: 200,
      contentID,
      totalReqDuration: Date.now() - reqStart,
      message: 'Content request successful.'
    });

    next();
  });
};

// Remove the revision ID from the first path segment of the contentID.
const removeRevisionID = function (contentID) {
  let asURL = url.parse(contentID);

  let pathSegments = asURL.pathname.split('/');
  pathSegments.splice(1, 1);
  asURL.pathname = pathSegments.join('/');

  return url.format(asURL);
};
