/*
 * Initialize the Restify server.
 */

var restify = require('restify');
var config = require('./config');
var routes = require('./routes');
var log = require('./logging').getLogger();

exports.create = function () {
  var server = restify.createServer();

  server.pre(restify.pre.sanitizePath());

  server.name = config.info.name;

  server.use(function (req, res, next) {
    log.verbose(req.method + ' ' + req.url);
    next();
  });

  server.use(restify.fullResponse());

  server.on('uncaughtException', function (req, res, route, err) {
    log.error({
      statusCode: err.statusCode || 500,
      requestURL: req.url,
      stack: err.stack,
      error: err.message,
      message: 'Uncaught exception'
    });
    res.send(err);
  });

  routes.loadRoutes(server);

  return server;
};
