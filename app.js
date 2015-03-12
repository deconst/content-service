/*
 * app.js: Entry point for the content-service
 *
 * (C) 2015 Rackspace, Inc.
 *
 */

var async = require('async'),
  pkgcloud = require('pkgcloud'),
  restify = require('restify'),
  version = require('./package.json').version;

var server = restify.createServer();

server.get('/version', function(req, res, next) {
  res.send(version);
  next();
});

server.listen(8080, function () {
  console.log('%s listening at %s', server.name, server.url);
});
