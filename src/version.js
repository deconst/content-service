// Echo the service name, version, and commit.

var config = require('./config');

/**
 * @description gets the version of the current service
 */
exports.report = function (req, res, next) {
  res.send({
    service: config.info.name,
    version: config.info.version,
    commit: config.commit
  });
  next();
};
