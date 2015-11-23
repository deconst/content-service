// Manage a connection to the Rackspace cloud. Retain and export handles to created resources.

var async = require('async');
var pkgcloud = require('pkgcloud');
var mongo = require('mongodb');
var elasticsearch = require('elasticsearch');
var config = require('../config');
var logger = require('../logging').getLogger();

/**
 * @description Create a function that asynchronously creates a Rackspace container if it
 *   doesn't already exist.
 */
function makeContainerCreator (client, containerName, logicalName, cdn) {
  return function (callback) {
    var reportBack = function (err, container) {
      if (err) return callback(err);

      exports[logicalName] = container;

      logger.debug('Container [' + container.name + '] now exists.');

      callback(null, container);
    };

    var cdnEnable = function (err, container) {
      if (err) return callback(err);

      logger.debug('Enabling CDN on container [' + container.name + '].');

      client.setCdnEnabled(container, {
        ttl: 31536000,
        enabled: true
      }, reportBack);
    };

    var handleCreation = cdn ? cdnEnable : reportBack;

    logger.info('Ensuring that container [' + containerName + '] exists.');

    // Instead of checking if the container exists first, we try to create it, and
    // if it already exists, we get a no-op (202) and move on.
    client.createContainer({
      name: containerName
    }, handleCreation);
  };
}

/**
 * @description Authenticate to MongoDB, export the active MongoDB connection as "db", and
 *   perform any necessary one-time initialization.
 */
function mongoInit (callback) {
  mongo.MongoClient.connect(config.mongodbURL(), function (err, db) {
    if (err) return callback(err);

    logger.debug('Connected to MongoDB database at [' + config.mongodbURL() + '].');

    exports.db = db;

    var envelopes = db.collection('envelopes');

    // Create indices on collections as necessary.
    async.parallel([
      function (callback) {
        envelopes.createIndex('tags', {
          sparse: true
        }, callback);
      },
      function (callback) {
        envelopes.createIndex('categories', {
          sparse: true
        }, callback);
      },
      function (callback) {
        envelopes.createIndex('contentID', {
          unique: true
        }, callback);
      }
    ], function (err, db) {
      if (err) return callback(err);

      logger.debug('All indices created.');

      callback(null);
    });
  });
}

/**
 * @description Shunt Elasticsearch log messages to the existing logger.
 */
function ElasticLogs (config) {
  var makeLogHandler = function (level) {
    return function (message) {
      logger[level]({
        action: 'elasticsearch',
        message: message
      });
    };
  };

  this.error = makeLogHandler('error');
  this.warning = makeLogHandler('warning');
  this.info = makeLogHandler('info');
  this.debug = makeLogHandler('debug');

  this.trace = function (httpMethod, requestUrl, requestBody, responseBody, responseStatus) {
    logger.trace({
      message: 'Elasticsearch HTTP request',
      httpMethod: httpMethod,
      requestUrl: requestUrl,
      requestBody: requestBody,
      responseBody: responseBody,
      responseStatus: responseStatus
    });

    this.close = function () {};
  };
}

/**
 * @description Authenticate to Elasticsearch and perform one-time initialization. Export the active
 * Elasticsearch client as "elastic".
 */
function elasticInit (callback) {
  var client = new elasticsearch.Client({
    host: config.elasticsearchHost(),
    ssl: { rejectUnauthorized: true }, // Plz no trivial MITM attacks
    log: ElasticLogs
  });

  exports.elastic = client;

  callback(null);
}

exports.setup = function (callback) {
  var client = pkgcloud.providers.rackspace.storage.createClient({
    username: config.rackspaceUsername(),
    apiKey: config.rackspaceAPIKey(),
    region: config.rackspaceRegion(),
    useInternal: config.rackspaceServiceNet()
  });

  client.on('log::*', function (message, object) {
    if (object) {
      logger.log(this.event.split('::')[1], message, object);
    } else {
      logger.log(this.event.split('::')[1], message);
    }
  });

  client.auth(function (err) {
    if (err) return callback(err);

    exports.client = client;

    async.parallel([
      makeContainerCreator(client, config.contentContainer(), 'contentContainer', false),
      makeContainerCreator(client, config.assetContainer(), 'assetContainer', true),
      mongoInit,
      elasticInit
    ], callback);
  });
};
