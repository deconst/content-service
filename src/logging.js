var winston = require('winston');
var config = require('./config');

var logger = null;

exports.getLogger = function () {
  if (logger) return logger;

  var activeTransports = [];

  if (process.env.NODE_ENV === 'production') {
    activeTransports.push(new winston.transports.Console({
      level: config.contentLogLevel().toLowerCase(),
      prettyPrint: false,
      colorize: config.contentLogColor(),
      timestamp: true,
      json: true,
      stringify: true,
      handleExceptions: true
    }));
  } else {
    activeTransports.push(new winston.transports.Console({
      level: config.contentLogLevel().toLowerCase(),
      prettyPrint: true,
      colorize: config.contentLogColor(),
      timestamp: true
    }));
  }

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
    transports: activeTransports
  });

  return logger;
};
