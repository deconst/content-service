var
  config = require('./config'),
  connection = require('./connection'),
  logging = require('./logging');

// Handlers
var
  version = require('./version'),
  content = require('./content'),
  assets = require('./assets');

var log = logging.getLogger(config.content_log_level());

exports.loadRoutes = function (server) {

  server.get('/version', version.report);

  server.get('/content/:id', content.retrieve);
  server.put('/content', content.store);
  server.del('/content/:id', content.delete);

  server.post('/assets', assets.accept);
};
