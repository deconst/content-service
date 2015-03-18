/*
 * app.js: Entry point for the content-service
 *
 * (C) 2015 Rackspace, Inc.
 *
 */

var async = require('async'),
  logging = require('./src/logging'),
  restify = require('restify'),
  routes = require('./src/routes'),
  info = require('./package.json');

var server = restify.createServer(),
  log = logging.getLogger(process.env.CONTENT_LOG_LEVEL || 'info');

server.name = info.name;

// TODO fully rationalize a strategy for ensuring configuration is correct

// validate we've got a properly setup environment
if (!process.env.RACKSPACE_USERNAME
  || !process.env.RACKSPACE_APIKEY
  || !process.env.RACKSPACE_REGION
  || !process.env.RACKSPACE_CONTAINER) {
  throw new Error('Required parameters not provided from the environment');
}

routes.client.createContainer({
  name: process.env.RACKSPACE_CONTAINER
}, function(err, container) {
  if (err) {
    throw new Error('Error creating Cloud Files container')
  }
});

// Setup some ghetto middleware
server
  .use(function foo(req, res, next) {
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
