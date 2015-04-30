/*
 * Initialize the Restify server.
 */

var
  restify = require("restify"),
  config = require("./config"),
  logging = require("./logging"),
  routes = require("./routes");

exports.create = function () {
  var
    server = restify.createServer(),
    log = logging.getLogger(config.content_log_level());

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
