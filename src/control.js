// Manage the SHA of the latest control repository commit.

var restify = require('restify');

var storage = require('./storage');
var log = require('./logging').getLogger();

exports.store = function (req, res, next) {
  if (req.params.sha === undefined) {
    return next(new restify.InvalidContentError('Missing required "sha" attribute'));
  }

  if (!/[0-9a-fA-F]{40}/.test(req.params.sha)) {
    return next(new restify.InvalidContentError('Not a valid "sha"'));
  }

  storage.storeSHA(req.params.sha, function (err) {
    next.ifError(err);

    res.send(204);

    log.info('Stored control repository SHA', {
      sha: req.params.sha
    });
    next();
  });
};

exports.retrieve = function (req, res, next) {};
