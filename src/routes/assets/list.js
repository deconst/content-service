'use strict';

const _ = require('lodash');
const urljoin = require('urljoin');
const request = require('request');
const storage = require('../../storage');
const config = require('../../config');

exports.handler = function (req, res, next) {
  req.logger.debug('Asset list requested.');

  enumerateNamed((err, assets) => {
    if (err) {
      req.logger.reportError('Unable to list assets.', err);
      return next(err);
    }

    if (config.proxyUpstream()) {
      let url = urljoin(config.proxyUpstream(), 'assets');
      req.logger.debug('Requesting upstream assets', { upstreamURL: url });

      request({ url, json: true }, (err, response, body) => {
        if (err || response.statusCode !== 200) {
          req.logger.reportError('Unable to retrieve upstream assets.', err, { statusCode: 502 });

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
  storage.findNamedAssets((err, assetVars) => {
    if (err) return callback(err);

    const assets = {};

    for (let i = 0; i < assetVars.length; i++) {
      const assetVar = assetVars[i];
      assets[assetVar.key] = assetVar.publicURL;
    }

    callback(null, assets);
  });
};
