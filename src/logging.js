var
  winston = require('winston'),
  config = require('./config');

var logger = null;

exports.getLogger = function () {
  if (logger) return logger;

  logger = new winston.Logger({
    levels: {
      trace: 0,
      debug: 1,
      verbose: 2,
      info: 3,
      warn: 4,
      error: 5
    },
    colors: {
      trace: 'white',
      debug: 'grey',
      verbose: 'cyan',
      info: 'green',
      warn: 'yellow',
      error: 'red'
    },
    transports: [
      new winston.transports.Console({
        level: config.contentLogLevel().toLowerCase(),
        prettyPrint: true,
        colorize: true,
        timestamp: true
      })
    ]
  });

  return logger;
};
