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
  setup = require('./src/setup');

var
  server = restify.createServer(),
  log = logging.getLogger(config.content_log_level());

server.name = config.info.name;

setup(config, function (err) {
  if (err) {
    throw err;
  }

  server
    .use(function (req, res, next) {
      log.verbose(req.method + ' ' + req.url);
      next();
    })
    .use(restify.fullResponse())
    .use(restify.bodyParser());

  routes.loadRoutes(server);

  server.listen(8080, function () {
    log.info('%s listening at %s', server.name, server.url);
  });
});
