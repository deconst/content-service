var restify = require('restify');

// Handlers
var auth = require('../auth');
var version = require('./version');
var content = require('./content');
var assets = require('./assets');
var keys = require('./keys');
var control = require('./control');
var reindex = require('./reindex');
var search = require('./search');

exports.loadRoutes = function (server) {
  server.get('/version', version.report);

  server.get('/content/:id', content.retrieve);
  server.put('/content/:id', auth.requireKey, restify.bodyParser(), content.store);
  server.del('/content/:id', auth.requireKey, content.remove);
  server.post('/bulkcontent', auth.requireKey, content.bulk);

  server.get('/assets', assets.list);
  server.get('/assets/:id', assets.retrieve);
  server.post('/assets', auth.requireKey, restify.bodyParser(), restify.queryParser(), assets.store);
  server.post('/bulkasset', auth.requireKey, restify.queryParser(), assets.bulk);

  server.get('/search', restify.queryParser(), search.query);

  server.post('/keys', auth.requireAdmin, restify.queryParser(), keys.issue);
  server.del('/keys/:key', auth.requireAdmin, keys.revoke);

  server.get('/control', control.retrieve);
  server.put('/control', auth.requireKey, restify.bodyParser(), control.store);

  server.post('/reindex', auth.requireAdmin, reindex.begin);
};
