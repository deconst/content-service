var restify = require('restify');

// Handlers
var
  version = require('./version'),
  content = require('./content'),
  assets = require('./assets'),
  keys = require('./keys');

exports.loadRoutes = function (server) {
  server.get('/version', version.report);

  server.get('/content/:id', content.retrieve);
  server.put('/content/:id', content.store);
  server.del('/content/:id', content.delete);

  server.post('/assets', restify.bodyParser(), restify.queryParser(), assets.accept);

  server.post('/keys', restify.queryParser(), keys.issue);
  server.del('/keys/:key', keys.revoke);
};
