'use strict';

const path = require('path');
const zlib = require('zlib');
const tar = require('tar-stream');
const logger = require('../../logging').getLogger();

/**
 * @description Publish new assets from an uploaded tarball.
 */
exports.handler = function (req, res, next) {
  const extract = tar.extract();
  const pack = tar.pack();

  extract.on('entry', (header, stream, next) => {
    if (header.type !== 'file') return next();
    const entryPath = header.name;
    const name = path.basename(entryPath);

    logger.debug('Received asset at path', { entryPath });

    const outs = pack.entry({ name, size: header.size }, (err) => {
      if (err) {
        return next();
      }

      logger.debug('Repacked asset for transit', { entryPath });

      next();
    });

    stream.pipe(outs);
  });

  extract.on('error', (err) => {
    logger.info('Corrupted tarball uploaded', {
      apikey: req.apikeyName,
      err: err.message,
      stack: err.stack
    });
  });

  extract.on('finish', () => {
    pack.finalize();

    res.send(200);
    next();
  });

  req.pipe(zlib.createGunzip()).pipe(extract);
};
