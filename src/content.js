// Store, retrieve, and delete metadata envelopes.

var
  config = require('./config'),
  connection = require('./connection'),
  logging = require('./logging');

var log = logging.getLogger(config.content_log_level());

/**
 * @description Retrieve content from the store by content ID.
 */
exports.retrieve = function (req, res, next) {
  log.debug("Requesting content ID: [" + req.params.id + "]");

  var source = connection.client.download({
    container: config.content_container(),
    remote: encodeURIComponent(req.params.id)
  });

  // This directly sends the response to the caller, long term we'll
  // probably not want to do this, but it allows the prototype to get functional
  //
  source.pipe(res);

  next();
};

/**
 * @description Store new content into the content service.
 */
exports.store = function (req, res, next) {
  log.info("Storing content with ID: [" + req.params.id + "]");

  var dest = connection.client.upload({
    container: config.content_container(),
    remote: encodeURIComponent(req.params.id)
  });

  dest.on('success', function () {
    res.status(200);
    res.send();
    next();
  });

  // For now, we're just going to write the body directly up to Cloud Files.
  // Longer term, we'll validate its structure and use async.parallel to upload it to different stores.
  req.pipe(dest);
};

/**
 * @description Delete a piece of previously stored content by content ID.
 */
exports.delete = function (req, res, next) {
  log.info("Deleting content with ID [" + req.params.id + "]");

  connection.client.removeFile(config.content_container(), encodeURIComponent(req.params.id), function (err) {
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
};
