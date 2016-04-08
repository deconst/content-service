'use strict';

const storage = require('../../storage');

exports.handler = function (req, res, next) {
  const assetFilename = req.params.id;

  req.logger.debug('Asset requested directly.', { assetFilename });

  storage.getAsset(assetFilename, (err, asset) => {
    if (err) {
      req.logger.reportError('Unable to retrieve asset.', err, {
        payload: { assetFilename }
      });
      return next(err);
    }

    // Bypass restify's formatter to keep it from being "helpful"
    res.setHeader('content-type', asset.contentType);
    res.writeHead(200);
    res.write(asset.body);
    res.end();

    req.logger.reportSuccess('Asset request successful.', {
      assetFilename,
      assetContentType: asset.contentType
    });
    next();
  });
};
