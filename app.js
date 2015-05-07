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
  connection = require('./src/connection'),
  server = require('./src/server');

var log = logging.getLogger(config.content_log_level());

connection.setup(function (err) {
  if (err) {
    throw err;
  }

  var app = server.create();

  app.listen(8080, function () {
    log.info('%s listening at %s', app.name, app.url);
  });
});
