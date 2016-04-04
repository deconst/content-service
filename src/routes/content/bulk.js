'use strict';

const targz = require('tar.gz');
const logger = require('../../logging').getLogger();

/**
 * @description Store new content into the content store from an uploaded tarball.
 */
module.exports = function (req, res, next) {
  const parse = targz().createParseStream();

  parse.on('entry', (entry) => {
    if (entry.type !== 'File') return;

    logger.debug('Received entry for path', { path: entry.path });
  });

  parse.on('error', (err) => {
    logger.info('Corrupted tarball uploaded', {
      err: err.message,
      stack: err.stack
    });

    res.send(400, err);

    next();
  });

  parse.on('end', () => {
    logger.debug('Tarball completed.');

    res.send(204);
    next();
  });

  req.pipe(parse);
};
