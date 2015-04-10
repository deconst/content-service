/*
 * app.js: Entry point for the content-service
 *
 * (C) 2015 Rackspace, Inc.
 *
 */

var config = require('./src/config');

config.configure(process.env);

var
  async = require('async'),
  restify = require('restify'),
  logging = require('./src/logging'),
  routes = require('./src/routes'),
  connection = require('./src/connection');

var
  server = restify.createServer(),
  log = logging.getLogger(config.content_log_level());

server.name = config.info.name;

connection.setup(function (err) {
  if (err) {
    throw err;
  }

  server
    .use(function (req, res, next) {
      log.verbose(req.method + ' ' + req.url);
      next();
    })
    .use(restify.fullResponse());

  routes.loadRoutes(server);

  server.listen(8080, function () {
    log.info('%s listening at %s', server.name, server.url);
  });
});
