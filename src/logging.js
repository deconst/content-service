'use strict';

const winston = require('winston');
const config = require('./config');

let logger = null;

const getLogger = exports.getLogger = function () {
  if (logger) return logger;

  const activeTransports = [];

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

exports.getRequestLogger = function (req) {
  return new RequestLogger(req);
};

function RequestLogger (req) {
  this.req = req;
}

RequestLogger.prototype.reportError = function (message, err, omitStack) {
  const payload = {
    error: err.message,
    statusCode: err.statusCode || 500
  };

  if (!omitStack && err.stack) {
    payload.stack = err.stack;
  }

  this.error(message, payload);
};

RequestLogger.prototype.reportSuccess = function (message, payload) {
  if (!payload) payload = {};

  payload.totalReqDuration = Date.now() - this.req.time();
  if (!payload.statusCode) payload.statusCode = 200;

  this.info(message, payload);
};

const makeLevelMethod = function (level) {
  return function (message, payload) {
    if (!payload) payload = {};

    if (this.req.apikeyName) payload.apikeyName = this.req.apikeyName;

    payload.route = `${this.req.route.method} ${this.req.route.path}`;

    if (!payload.totalReqDuration) {
      payload.reqDuration = Date.now() - this.req.time();
    }

    getLogger()[level](message, payload);
  };
};

['trace', 'debug', 'verbose', 'info', 'warn', 'error'].forEach((level) => {
  RequestLogger.prototype[level] = makeLevelMethod(level);
});
