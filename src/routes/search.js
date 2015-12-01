// Accept full-text search queries

var restify = require('restify');
var logger = require('../logging').getLogger();
var storage = require('../storage');

exports.query = function (req, res, next) {
  var q = req.params.q;
  var perPage = req.params.perPage || 10;
  var pageNumber = req.params.pageNumber || 1;

  var startTs = Date.now();
  var logPayload = {
    event: 'search',
    query: q,
    perPage: perPage,
    pageNumber: pageNumber
  };

  if (q === null || q === undefined) {
    logger.info('Missing required query parameter', logPayload);
    res.send(new restify.MissingParameterError('q parameter is required'));
    return;
  }

  logger.debug('Beginning search', logPayload);

  storage.queryContent(q, pageNumber, perPage, function (err, results) {
    logPayload.duration = Date.now() - startTs;

    if (err) {
      logPayload.errMessage = err.message;
      logPayload.stack = err.stack;

      logger.error('Error performing search', logPayload);
      res.send(new restify.InternalServerError('Error performing search'));
      return;
    }

    logPayload.totalResultCount = results.hits.total;
    logPayload.pageResultCount = results.hits.hits.length;
    logger.info('Successfully completed search', logPayload);

    var doc = results.hits.hits.map(function (each) {
      var transformed = {
        contentID: each._id,
        title: each._source.title
      };

      if (each.highlight.body.length > 0) {
        transformed.excerpt = each.highlight.body[0];
      }

      return transformed;
    });

    res.send(200, {
      total: results.hits.total,
      results: doc
    });
    next();
  });
};
