'use strict';

const url = require('url');
const request = require('request');
const urljoin = require('urljoin');
const storage = require('../../storage');
const config = require('../../config');

/**
 * @description Retrieve content from the store by content ID. If PROXY_UPSTREAM is set, make a
 * request to the configured upstream content service's API.
 */
exports.handler = function (req, res, next) {
  let contentID = req.params.id;

  req.logger.debug('Content ID request received.', { contentID });

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

    req.logger.debug('Making upstream content request.', {
      contentID,
      upstreamContentID,
      upstreamURL: url
    });

    request({ url, json: true }, (err, response, body) => {
      if (err) return callback(err);

      if (response.statusCode === 404) {
        req.logger.debug('Content not found in upstream.', {
          contentID,
          upstreamContentID,
          upstreamURL: url
        });

        let err = new Error('Content not found');
        err.statusCode = 404;
        err.responseBody = response.body;

        return callback(err);
      }

      if (response.statusCode !== 200) {
        req.logger.error('Upstream content request error', {
          contentID,
          upstreamContentID,
          upstreamURL: url,
          statusCode: response.statusCode
        });

        let err = new Error('Upstream proxy error');
        err.statusCode = 502;
        err.responseBody = response.body;

        return callback(err);
      }

      req.logger.debug('Upstream content request successful.', {
        contentID,
        upstreamContentID,
        upstreamURL: url
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

      req.logger.reportError(message, err, { payload: { contentID } });
      return next(err);
    }

    res.json(doc);
    req.logger.reportSuccess('Content request successful.', { contentID });
    next();
  });
};

// Remove the revision ID from the first path segment of the contentID.
const removeRevisionID = exports.removeRevisionID = function (contentID) {
  let asURL = url.parse(contentID);

  let pathSegments = asURL.pathname.split('/');
  pathSegments.splice(1, 1);
  asURL.pathname = pathSegments.join('/');

  return url.format(asURL);
};
