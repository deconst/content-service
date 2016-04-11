'use strict';

// Test for the existence of metadata envelopes by fingerprint

const restify = require('restify');
const request = require('request');
const urljoin = require('urljoin');
const config = require('../../config');
const storage = require('../../storage');

exports.handler = function (req, res, next) {
  const contentIDMap = req.body;

  storage.envelopesExist(contentIDMap, (err, existence) => {
    if (err) {
      req.logger.handleError('Unable to query content with fingerprints', err);
      return next(new restify.errors.InternalServerError('Unable to query content fingerprints'));
    }

    const results = {};
    for (var contentID in existence) {
      if (existence.hasOwnProperty(contentID)) {
        results[contentID] = existence[contentID].present && existence[contentID].matches;
      }
    }

    const complete = () => {
      res.send(results);
      req.logger.reportSuccess('Content ID fingerprint query', {
        envelopeCount: Object.keys(contentIDMap).length
      });
      next();
    };

    if (config.proxyUpstream()) {
      const url = urljoin(config.proxyUpstream(), 'checkcontent');

      // Query upstream for all envelopes that are not present locally. Exclude any that were
      // present but had different fingerprints.
      const query = {};
      for (let contentID in existence) {
        if (existence.hasOwnProperty(contentID)) {
          if (!existence[contentID].present) {
            query[contentID] = contentIDMap[contentID];
          }
        }
      }

      req.logger.debug('Making an upstream content fingerprint query', {
        url,
        queryCount: Object.keys(query).length
      });

      request({ url, body: query, json: true }, (err, response, body) => {
        if (err) {
          req.logger.reportError('Unable to query upstream with content fingerprints.', err);
          return next(new restify.errors.BadGatewayError('Unable to query upstream for content fingerprints'));
        }

        if (response.statusCode !== 200) {
          req.logger.reportError('Non-200 status from upstream content fingerprint check.');
          return next(new restify.errors.BadGatewayError('Unable to query upstream for content fingerprints'));
        }

        // Merge in upstream results.
        for (let contentID in body) {
          if (body.hasOwnProperty(contentID) && body[contentID]) {
            results[contentID] = true;
          }
        }

        complete();
      });
    } else {
      complete();
    }
  });
};
