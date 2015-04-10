var restify = require('restify');

// Handlers
var
  version = require('./version'),
  content = require('./content'),
  assets = require('./assets');

exports.loadRoutes = function (server) {
  server.get('/version', version.report);

  server.get('/content/:id', content.retrieve);
  server.put('/content/:id', content.store);
  server.del('/content/:id', content.delete);

  server.post('/assets', restify.bodyParser(), restify.queryParser(), assets.accept);
};
