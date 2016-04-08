'use strict';

/*
 * Initialize the Restify server.
 */

const restify = require('restify');
const config = require('./config');
const routes = require('./routes');
const logging = require('./logging');

exports.create = function () {
  const server = restify.createServer();

  server.pre(restify.pre.sanitizePath());

  server.name = config.info.name;

  server.use(function (req, res, next) {
    req.logger = logging.getRequestLogger(req);

    req.logger.verbose(req.method + ' ' + req.url);
    next();
  });

  server.use(restify.fullResponse());

  server.on('uncaughtException', function (req, res, route, err) {
    req.logger.error('Uncaught exception', {
      statusCode: err.statusCode || 500,
      requestURL: req.url,
      stack: err.stack,
      error: err.message
    });

    res.send(err);
  });

  routes.loadRoutes(server);

  return server;
};
