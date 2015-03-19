var pkgcloud = require('pkgcloud');

var client = pkgcloud.providers.rackspace.storage.createClient({
  username: process.env.RACKSPACE_USERNAME,
  apiKey: process.env.RACKSPACE_APIKEY,
  region: process.env.RACKSPACE_REGION
});
exports.client = client

exports.loadRoutes = function(server, info) {

  /**
   }
   * @description gets the version of the current service
   */
  server.get('/version', function (req, res, next) {
    res.send(info.version);
    next();
  });

  /**
   * @description Allows retrieving content from the content service
   */
  server.get('/content/:id', function (req, res, next) {
    var source = client.download({
      container: process.env.RACKSPACE_CONTAINER,
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
 *   id: "https://github.com/deconst/deconst-docs/issues/16" // Full url of content
 *   body: { }
 * }
   *
   */
  server.put('/content', function (req, res, next) {
    var dest = client.upload({
      container: process.env.RACKSPACE_CONTAINER,
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
    client.removeFile(process.env.RACKSPACE_CONTAINER, encodeURIComponent(req.params.id), function (err) {
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
