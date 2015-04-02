var
  pkgcloud = require('pkgcloud'),
  config = require('./config'),
  logging = require('./logging');

var log = logging.getLogger(config.content_log_level());

exports.loadRoutes = function (server) {

  /**
   * @description gets the version of the current service
   */
  server.get('/version', function (req, res, next) {
    res.send({
      service: config.info.name,
      version: config.info.version,
      commit: config.commit
    });
    next();
  });

  /**
   * @description Allows retrieving content from the content service
   */
  server.get('/content/:id', function (req, res, next) {
    log.debug("Requesting content ID: [" + req.params.id + "]");

    var source = config.client.download({
      container: config.content_container(),
      remote: encodeURIComponent(req.params.id)
    });

    // This directly sends the response to the caller, long term we'll
    // probably not want to do this, but it allows the prototype to get functional
    //
    source.pipe(res);

    next();
  });

  /**
   * @description Allows storing new content into the content service
   *
   * Payload must be in the form of:
   *
   * {
   *   id: "https://github.com/deconst/deconst-docs/issues/16", // Full url of content
   *   body: { }
   * }
   *
   */
  server.put('/content', function (req, res, next) {
    log.info("Storing content with ID: [" + req.body.id + "]");

    var dest = config.client.upload({
      container: config.content_container(),
      remote: encodeURIComponent(req.body.id)
    });

    dest.on('success', function () {
      res.status(200);
      res.send();
      next();
    });

    // For now we're just going to JSON.stringify the body directly up to cloud files
    // longer term we might do multi-plexing or async.parallel to different stores
    dest.end(JSON.stringify(req.body.body));
  });

  /**
   * @description Delete a piece of content by id
   */
  server.del('/content/:id', function (req, res, next) {
    log.info("Deleting content with ID [" + req.params.id + "]");

    config.client.removeFile(config.content_container(), encodeURIComponent(req.params.id), function (err) {
      if (err) {
        res.status(err.statusCode);
        res.send();
        next();
        return;
      }

      res.status(200);
      res.send();
      next();
    });
  });

};
