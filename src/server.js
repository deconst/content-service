/*
 * Initialize the Restify server.
 */

var
  restify = require("restify"),
  config = require("./config"),
  log = require("./logging").logger,
  routes = require("./routes");

exports.create = function () {
  var server = restify.createServer();

  server.name = config.info.name;

  server
    .use(function (req, res, next) {
      log.verbose(req.method + ' ' + req.url);
      next();
    })
    .use(restify.fullResponse());

  routes.loadRoutes(server);

  return server;
};
