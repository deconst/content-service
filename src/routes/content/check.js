'use strict';

// Test for the existence of metadata envelopes by fingerprint

const restify = require('restify');
const storage = require('../../storage');

exports.handler = function (req, res, next) {
  const contentIDMap = req.body;

  storage.envelopesExist(contentIDMap, (err, results) => {
    if (err) {
      req.logger.handleError('Unable to query content with fingerprints', err);
      return next(new restify.errors.InternalServerError('Unable to query content fingerprints'));
    }

    res.send(results);
    req.logger.reportSuccess('Content ID fingerprint query', {
      envelopeCount: Object.keys(contentIDMap).length
    });
    next();
  });
};
