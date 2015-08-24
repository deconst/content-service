var restify = require('restify');

// Handlers
var auth = require('./auth');
var version = require('./version');
var content = require('./content');
var assets = require('./assets');
var keys = require('./keys');

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

  server.get('/assets', assets.list);
  server.get('/assets/:id', assets.retrieve);

  server.post('/keys', auth.requireAdmin, restify.queryParser(), keys.issue);
  server.del('/keys/:key', auth.requireAdmin, keys.revoke);
};
