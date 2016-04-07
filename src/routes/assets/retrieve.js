'use strict';

const storage = require('../../storage');
const logger = require('../../logging').getLogger();

exports.handler = function (req, res, next) {
  logger.debug({
    action: 'assetretrieve',
    message: 'Asset requested directly.'
  });

  var reqStart = Date.now();

  storage.getAsset(req.params.id, function (err, asset) {
    if (err) {
      logger.error({
        action: 'assetretrieve',
        statusCode: err.statusCode || 500,
        message: 'Unable to retrieve asset',
        error: err.message,
        stack: err.stack
      });
      return next(err);
    }

    // Bypass restify's formatter to keep it from being "helpful"
    res.setHeader('content-type', asset.contentType);
    res.writeHead(200);
    res.write(asset.body);
    res.end();

    logger.info({
      action: 'assetretrieve',
      statusCode: 200,
      assetFilename: req.params.id,
      assetContentType: asset.contentType,
      totalReqDuration: Date.now() - reqStart,
      message: 'Asset request successful.'
    });

    next();
  });
};
