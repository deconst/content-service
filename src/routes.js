// Handlers
var
  version = require('./version'),
  content = require('./content'),
  assets = require('./assets');

exports.loadRoutes = function (server) {
  server.get('/version', version.report);

  server.get('/content/:id', content.retrieve);
  server.put('/content', content.store);
  server.del('/content/:id', content.delete);

  server.post('/assets', assets.accept);
};
