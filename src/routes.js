var restify = require('restify');

// Handlers
var
  auth = require('./auth'),
  version = require('./version'),
  content = require('./content'),
  assets = require('./assets'),
  keys = require('./keys');

exports.loadRoutes = function (server) {
  server.get('/version', version.report);

  server.get('/content/:id', content.retrieve);
  server.put('/content/:id', auth.require_key, restify.bodyParser(), content.store);
  server.del('/content/:id', auth.require_key, content.delete);

  server.post('/assets',
    auth.require_key,
    restify.bodyParser(),
    restify.queryParser(),
    assets.accept);

  server.post('/keys', auth.require_admin, restify.queryParser(), keys.issue);
  server.del('/keys/:key', auth.require_admin, keys.revoke);
};
