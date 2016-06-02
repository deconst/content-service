'use strict';

exports.handler = function (req, res, next) {
  req.logger.debug('Content list requested.');

  res.send(200, {});
};
