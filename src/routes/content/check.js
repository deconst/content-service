'use strict';

// Test for the existence of metadata envelopes by fingerprint

const _ = require('lodash');
const restify = require('restify');
const request = require('request');
const urljoin = require('urljoin');
const config = require('../../config');
const storage = require('../../storage');
const removeRevisionID = require('./retrieve').removeRevisionID;

exports.handler = function (req, res, next) {
  const fingerprints = req.body;

  storage.envelopesExist(fingerprints, (err, existence) => {
    if (err) {
      req.logger.handleError('Unable to query content with fingerprints', err);
      return next(new restify.errors.InternalServerError('Unable to query content fingerprints'));
    }

    const localResults = _.mapValues(existence, (e) => e.present && e.matches);

    const complete = (results) => {
      res.send(results);
      req.logger.reportSuccess('Content ID fingerprint query', {
        envelopeCount: Object.keys(fingerprints).length
      });
      next();
    };

    if (config.proxyUpstream()) {
      const query = { existence, fingerprints: {} };
      _.forOwn(fingerprints, (fingerprint, contentID) => {
        if (!existence[contentID].present) {
          query.fingerprints[contentID] = fingerprint;
        }
      });

      checkUpstream(req.logger, query, (err, upresults) => {
        if (err) return next(err);
        complete(_.assign(localResults, upresults));
      });
    } else {
      complete(localResults);
    }
  });
};

/**
 * @description Query an upstream content store for any envelopes that were not present locally.
 * When staging mode is active as well, translate content IDs from the query by removing the
 * initial path segment, then retranslate result IDs back to the original content IDs.
 *
 * If multiple content IDs from the query map to the same upstream content ID, a separate,
 * recursive upstream query will be performed with the conflicting content IDs. Its results will
 * merged in with this call's before the callback is invoked.
 *
 * Structure of the "query" parameter:
 *
 * {
 *  existence: { <contentID>: { present: <Boolean>, matches: <Boolean> } },
 *  fingerprints: { <contentID>: <fingerprint> }
 * }
 */
const checkUpstream = function (logger, query, callback) {
  const url = urljoin(config.proxyUpstream(), 'checkcontent');

  const payload = {};
  const mapping = {};
  const subquery = {
    existence: query.existence,
    fingerprints: {}
  };

  for (let contentID in query.fingerprints) {
    if (query.fingerprints.hasOwnProperty(contentID)) {
      if (!query.existence[contentID].present) {
        if (config.stagingMode()) {
          const upstreamID = removeRevisionID(contentID);

          // Remember the original contentID this upstreamID maps to. If multiple content IDs
          // map to the same upstream ID, skip subsequent ones and instead begin constructing a
          // subquery.
          if (upstreamID in mapping) {
            subquery.fingerprints[contentID] = query.fingerprints[contentID];
          } else {
            mapping[upstreamID] = contentID;
            payload[upstreamID] = query.fingerprints[contentID];
          }
        } else {
          // When not in staging mode, no contentID translation is necessary.
          payload[contentID] = query.fingerprints[contentID];
        }
      }
    }
  }

  logger.debug('Making an upstream content fingerprint query', {
    url,
    queryCount: Object.keys(payload).length
  });

  request({ url, body: payload, json: true }, (err, response, body) => {
    if (err) {
      logger.reportError('Unable to query upstream with content fingerprints.', err);
      return callback(new restify.errors.BadGatewayError('Unable to query upstream for content fingerprints'));
    }

    if (response.statusCode !== 200) {
      logger.reportError('Non-200 status from upstream content fingerprint check.', null, {
        statusCode: response.statusCode
      });

      return callback(new restify.errors.BadGatewayError('Unable to query upstream for content fingerprints'));
    }

    let results = body;
    if (config.stagingMode()) {
      // When in staging mode, use the stored mapping to report results in terms of the original
      // query contentIDs.
      results = _.mapKeys(body, (v, upstreamID) => mapping[upstreamID]);
    }

    // Perform additional queries for ambiguous contentIDs if required.
    if (Object.keys(subquery.fingerprints).length > 0) {
      checkUpstream(logger, subquery, (err, subresults) => {
        if (err) return callback(err);

        // Merge subquery results into this query's.
        callback(null, _.assign(results, subresults));
      });
    } else {
      // No subquery necessary. Report directly.
      callback(null, results);
    }
  });
};
