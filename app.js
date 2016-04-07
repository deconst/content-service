/*
 * app.js: Entry point for the content-service
 *
 * (C) 2015 Rackspace, Inc.
 *
 */

var config = require('./src/config');

config.configure(process.env);

var log = require('./src/logging').getLogger();
var server = require('./src/server');
var storage = require('./src/storage');

storage.setup(function (err) {
  if (err) {
    throw err;
  }

  var app = server.create();

  app.server.setTimeout(600000);

  process.on('SIGTERM', function () {
    log.info('Shutting down.');
    app.close();
  });

  app.listen(8080, function () {
    log.info('%s listening at %s', app.name, app.url);
  });
});
