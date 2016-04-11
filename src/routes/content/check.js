'use strict';

// Test for the existence of metadata envelopes by fingerprint

const restify = require('restify');
const request = require('request');
const urljoin = require('urljoin');
const config = require('../../config');
const storage = require('../../storage');
const removeRevisionID = require('./retrieve').removeRevisionID;

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
      // present but had different fingerprints. Remove the initial path segment when in staging
      // mode, but track the mapping of modified content IDs to original ones.
      const query = {};
      const queryMapping = {};
      for (let contentID in existence) {
        if (existence.hasOwnProperty(contentID)) {
          if (!existence[contentID].present) {
            if (config.stagingMode()) {
              const upstreamID = removeRevisionID(contentID);

              // Remember which original contentID this upstreamID maps to. If multiple content IDs
              // map to the same upstream ID, return an error.
              if (upstreamID in queryMapping) {
                req.logger.warn('Duplicate upstream content ID in upstream content fingerprint query', {
                  contentID,
                  upstreamID,
                  statusCode: 400
                });
                return next(new restify.errors.BadRequestError('Multiple content IDs mapped to single upstream content ID'));
              }
              queryMapping[upstreamID] = contentID;

              query[upstreamID] = contentIDMap[contentID];
            } else {
              query[contentID] = contentIDMap[contentID];
            }
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

        // Merge in upstream results. When in staging mode, use queryMapping to report results
        // in terms of the original query values.
        for (let contentID in body) {
          if (body.hasOwnProperty(contentID) && body[contentID]) {
            if (config.stagingMode()) {
              const originalID = queryMapping[contentID];
              results[originalID] = true;
            } else {
              results[contentID] = true;
            }
          }
        }

        complete();
      });
    } else {
      complete();
    }
  });
};
