'use strict';

// Manage a connection to the Rackspace cloud. Retain and export handles to created resources.

const url = require('url');
const async = require('async');
const pkgcloud = require('pkgcloud');
const mongo = require('mongodb');
const elasticsearch = require('elasticsearch');
const config = require('../config');
const logger = require('../logging').getLogger();

/**
 * @description Create a function that asynchronously creates a Rackspace container if it
 *   doesn't already exist.
 */
function makeContainerCreator (cloud, containerName, logicalName, cdn) {
  return (callback) => {
    const reportBack = (err, container) => {
      if (err) return callback(err);

      exports[logicalName] = container;

      logger.debug(`Container [${container.name}] now exists.`);

      callback(null, container);
    };

    const cdnEnable = (err, container) => {
      if (err) return callback(err);

      logger.debug(`Enabling CDN on container [${container.name}].`);

      cloud.setCdnEnabled(container, {
        ttl: 31536000,
        enabled: true
      }, reportBack);
    };

    const handleCreation = cdn ? cdnEnable : reportBack;

    logger.info(`Ensuring that container [${containerName}] exists.`);

    // Instead of checking if the container exists first, we try to create it, and
    // if it already exists, we get a no-op (202) and move on.
    cloud.createContainer({ name: containerName }, handleCreation);
  };
}

/**
 * @description Authenticate to MongoDB, export the active MongoDB connection as "mongo", and
 *   perform any necessary one-time initialization.
 */
function mongoInit (callback) {
  mongo.MongoClient.connect(config.mongodbURL(), (err, mongo) => {
    if (err) {
      logger.warn('Error connecting to MongoDB database. Retrying in five seconds.', {
        mongodbURL: config.mongodbURL(),
        err: err.message
      });

      setTimeout(() => mongoInit(callback), 5000);
      return;
    }

    logger.debug(`Connected to MongoDB database at [${config.mongodbURL()}].`);
    exports.mongo = mongo;
    callback(null);
  });
}

/**
 * @description Shunt Elasticsearch log messages to the existing logger.
 */
function ElasticLogs (config) {
  const makeLogHandler = (level) => {
    return (message) => {
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

  this.trace = (httpMethod, requestUrl, requestBody, responseBody, responseStatus) => {
    requestUrl.pathname = requestUrl.path;

    logger.trace({
      message: 'Elasticsearch HTTP request',
      httpMethod: httpMethod,
      requestUrl: url.format(requestUrl),
      requestBody: requestBody,
      responseBody: responseBody,
      responseStatus: responseStatus
    });
  };

  this.close = () => {};
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

  const client = new elasticsearch.Client({
    host: config.elasticsearchHost(),
    apiVersion: '1.7',
    ssl: { rejectUnauthorized: true }, // Plz no trivial MITM attacks
    log: ElasticLogs,
    maxRetries: Infinity
  });

  client.ping((err) => {
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
  const cloud = pkgcloud.providers.rackspace.storage.createClient({
    username: config.rackspaceUsername(),
    apiKey: config.rackspaceAPIKey(),
    region: config.rackspaceRegion(),
    useInternal: config.rackspaceServiceNet()
  });

  cloud.on('log::*', function (message, object) {
    if (object) {
      logger.log(this.event.split('::')[1], message, object);
    } else {
      logger.log(this.event.split('::')[1], message);
    }
  });

  cloud.auth(function (err) {
    if (err) return callback(err);

    exports.cloud = cloud;

    async.parallel([
      makeContainerCreator(cloud, config.assetContainer(), 'assetContainer', true),
      mongoInit,
      elasticInit
    ], callback);
  });
};
