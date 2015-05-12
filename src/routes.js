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
  server.put('/content/:id', auth.requireKey, restify.bodyParser(), content.store);
  server.del('/content/:id', auth.requireKey, content.delete);

  server.post('/assets',
    auth.requireKey,
    restify.bodyParser(),
    restify.queryParser(),
    assets.accept);

  server.post('/keys', auth.requireAdmin, restify.queryParser(), keys.issue);
  server.del('/keys/:key', auth.requireAdmin, keys.revoke);
};
