'use strict';

const crypto = require('crypto');
const path = require('path');
const zlib = require('zlib');
const tar = require('tar-stream');
const storage = require('../../storage');
const logger = require('../../logging').getLogger();

/**
 * @description Publish new assets from an uploaded tarball.
 */
exports.handler = function (req, res, next) {
  const extract = tar.extract();
  const pack = tar.pack();

  const reportError = (err, entryPath, description) => {
    logger.warn(`Bulk asset upload problem: ${description}`, {
      action: 'bulkassetstore',
      apikeyName: req.apikeyName,
      entryPath,
      err: err.message,
      stack: err.stack,
      statusCode: 400
    });
  };

  extract.on('entry', (header, stream, next) => {
    if (header.type !== 'file') return next();
    const entryPath = header.name;
    const sha256sum = crypto.createHash('sha256');
    const chunks = [];

    logger.debug('Received asset at path', { entryPath });

    stream.on('data', (chunk) => {
      sha256sum.update(chunk);
      chunks.push(chunk);
    });

    stream.on('error', (err) => {
      reportError(err);
      next();
    });

    stream.on('end', () => {
      const body = Buffer.concat(chunks, header.size);
      const ext = path.extname(entryPath);
      const bname = path.basename(entryPath, ext);
      const name = `${bname}-${sha256sum.digest('hex')}${ext}`;

      pack.entry({ name }, body);
      logger.debug('Repacked asset', { entryPath, name });
      next();
    });
  });

  extract.on('error', (err) => {
    logger.info('Corrupted asset tarball uploaded', {
      action: 'bulkassetstore',
      apikey: req.apikeyName,
      err: err.message,
      stack: err.stack
    });

    res.send(400, err);
    next();
  });

  extract.on('finish', () => pack.finalize());

  storage.bulkStoreAssets(pack.pipe(zlib.createGzip()), (err) => {
    if (err) {
      return next(err);
    }

    res.send(200);
    next();
  });

  req.pipe(zlib.createGunzip()).pipe(extract);
};
