/*
 * app.js: Entry point for the content-service
 *
 * (C) 2015 Rackspace, Inc.
 *
 */

var config = require('./src/config');

config.configure();

var
  async = require('async'),
  restify = require('restify'),
  child_process = require("child_process"),
  logging = require('./src/logging'),
  routes = require('./src/routes'),
  info = require('./package.json');

var
  server = restify.createServer(),
  log = logging.getLogger(config.content_log_level());

info.commit = child_process.execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
server.name = info.name;

// Instead of checking if the container exists first, we try to create it, and
// if it already exists, we get a no-op (202) and move on.
routes.client.createContainer({
  name: config.rackspace_container()
}, function(err, container) {
  if (err) {
    throw new Error('Error creating Cloud Files container');
  }

  // Setup some ghetto middleware
  server
    .use(function (req, res, next) {
      log.verbose(req.method + ' ' + req.url);
      next();
    })
    .use(restify.fullResponse())
    .use(restify.bodyParser());

  // this is kind of hacky, but for now it keeps our routes a bit less messy
  routes.loadRoutes(server, info);

  server.listen(8080, function () {
    log.info('%s listening at %s', server.name, server.url);
  });
});
