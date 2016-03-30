// Manage a connection to the Rackspace cloud. Retain and export handles to created resources.

var url = require('url');
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
    if (err) {
      logger.warn('Error connecting to MongoDB database. Retrying in five seconds.', {
        mongodbURL: config.mongodbURL(),
        err: err.message
      });

      setTimeout(() => mongoInit(callback), 5000);
      return;
    }

    logger.debug('Connected to MongoDB database at [' + config.mongodbURL() + '].');
    exports.db = db;
    callback(null);
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
  this.warning = makeLogHandler('warn');
  this.info = makeLogHandler('info');
  this.debug = makeLogHandler('debug');

  this.trace = function (httpMethod, requestUrl, requestBody, responseBody, responseStatus) {
    requestUrl.pathname = requestUrl.path;

    logger.trace({
      message: 'Elasticsearch HTTP request',
      httpMethod: httpMethod,
      requestUrl: url.format(requestUrl),
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
  if (!config.elasticsearchHost()) {
    logger.info('Omitting Elasticsearch connection. Search will be unavailable.');

    return callback(null);
  }

  var client = new elasticsearch.Client({
    host: config.elasticsearchHost(),
    apiVersion: '1.7',
    ssl: { rejectUnauthorized: true }, // Plz no trivial MITM attacks
    log: ElasticLogs,
    maxRetries: Infinity
  });

  client.ping(function (err) {
    if (err) {
      logger.warn('Unable to connect to Elasticsearch. Retrying in five seconds.', {
        elasticsearchHost: config.elasticsearchHost(),
        err: err.message
      });

      setTimeout(() => elasticInit(callback), 5000);
      return;
    }

    logger.debug('Connected to Elasticsearch.');

    exports.elastic = client;

    callback(null);
  });
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
