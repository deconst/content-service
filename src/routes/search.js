// Accept full-text search queries

var restify = require('restify');
var logger = require('../logging').getLogger();
var storage = require('../storage');

exports.query = function (req, res, next) {
  var q = req.params.q;
  var perPage = req.params.perPage || 10;
  var pageNumber = req.params.pageNumber || 1;

  var startTs = Date.now();
  var logPayload = {query: q, perPage: perPage, pageNumber: pageNumber};

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

    res.send(200, {
      results: results.hits.hits.map(function (each) {
        return { contentID: each._id };
      })
    });
    next();
  });
};
