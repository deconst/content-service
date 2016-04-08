'use strict';

// Accept full-text search queries

var restify = require('restify');
var storage = require('../storage');

exports.query = function (req, res, next) {
  var q = req.params.q;
  var perPage = req.params.perPage || 10;
  var pageNumber = req.params.pageNumber || 1;
  var categories = req.params.categories;

  if (typeof categories === 'string') {
    categories = [categories];
  }

  var logPayload = {
    query: q,
    perPage,
    pageNumber,
    categories
  };

  if (q === null || q === undefined) {
    req.logger.info('Missing required query parameter', logPayload);
    res.send(new restify.MissingParameterError('q parameter is required'));
    return;
  }

  req.logger.debug('Beginning search', logPayload);

  storage.queryEnvelopes(q, categories, pageNumber, perPage, function (err, results) {
    if (err) {
      req.logger.reportError('Error performing search', err, { payload: logPayload });
      res.send(new restify.InternalServerError('Error performing search'));
      return;
    }

    logPayload.totalResultCount = results.hits.total;
    logPayload.pageResultCount = results.hits.hits.length;

    const doc = results.hits.hits.map(function (each) {
      const transformed = {
        contentID: each._id,
        title: each._source.title
      };

      if (each.highlight && each.highlight.body.length > 0) {
        transformed.excerpt = each.highlight.body[0];
      } else {
        transformed.excerpt = each._source.body.substr(0, 150);
      }

      return transformed;
    });

    res.send(200, {
      total: results.hits.total,
      results: doc
    });
    req.logger.info('Successfully completed search', logPayload);
    next();
  });
};
