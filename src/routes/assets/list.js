'use strict';

const _ = require('lodash');
const urljoin = require('urljoin');
const request = require('request');
const storage = require('../../storage');
const config = require('../../config');
const logger = require('../../logging').getLogger();

exports.handler = function (req, res, next) {
  logger.debug('Asset list requested.');

  enumerateNamed(function (err, assets) {
    if (err) {
      logger.error({
        action: 'assetlist',
        statusCode: err.statusCode || 500,
        message: 'Unable to list assets.',
        error: err.message,
        stack: err.stack
      });
      return next(err);
    }

    if (config.proxyUpstream()) {
      let url = urljoin(config.proxyUpstream(), 'assets');
      logger.debug('Requesting upstream assets', {
        upstreamURL: url
      });

      request({ url, json: true }, (err, response, body) => {
        if (err || response.statusCode !== 200) {
          logger.error('Unable to retrieve upstream assets.', {
            action: 'assetlist',
            statusCode: response.statusCode,
            error: err ? err.message : null,
            stack: err ? err.stack : null
          });

          let e = new Error('Unable to retrieve upstream assets.');
          e.statusCode = 502;
          return next(e);
        }

        assets = _.merge(body, assets);

        res.send(assets);
        next();
      });
      return;
    }

    res.send(assets);
    next();
  });
};

/**
 * @description Enumerate all named assets.
 */
const enumerateNamed = exports.enumerateNamed = function (callback) {
  storage.findNamedAssets(function (err, assetVars) {
    if (err) {
      return callback(err);
    }

    var assets = {};

    for (var i = 0; i < assetVars.length; i++) {
      var assetVar = assetVars[i];
      assets[assetVar.key] = assetVar.publicURL;
    }

    callback(null, assets);
  });
};
