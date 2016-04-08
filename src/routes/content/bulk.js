'use strict';

const async = require('async');
const path = require('path');
const zlib = require('zlib');
const tar = require('tar-stream');
const logger = require('../../logging').getLogger();
const storage = require('../../storage');
const storeEnvelope = require('./store').storeEnvelope;
const removeEnvelopes = require('./remove').removeEnvelopes;

/**
 * @description Store new content into the content store from an uploaded tarball.
 */
exports.handler = function (req, res, next) {
  const reqStart = Date.now();

  let contentIDBase = null;
  let envelopeCount = 0;
  let failureCount = 0;
  let deletionCount = 0;
  let toKeep = {};

  const envelopeWorker = (task, cb) => {
    logger.debug('Beginning envelope storage', {
      contentID: task.contentID
    });

    let storageStart = Date.now();

    storeEnvelope(task.contentID, task.envelope, (err) => {
      if (err) {
        failureCount++;
        reportError(err, null, 'storing metadata envelope');
        return cb();
      }

      envelopeCount++;

      logger.debug('Envelope stored successfully', {
        contentID: task.contentID,
        envelopeCount,
        failureCount,
        storageDuration: Date.now() - storageStart
      });

      cb();
    });
  };

  const uploadQueue = async.queue(envelopeWorker, 10);

  // Log an error and optionally report it to the user.
  const reportError = (err, entryPath, description, fatal) => {
    const logPayload = {
      action: 'bulkcontentstore',
      apikeyName: req.apikeyName,
      entryPath,
      err: err.message,
      stack: err.stack,
      statusCode: 400,
      totalReqDuration: Date.now() - reqStart
    };

    if (fatal) {
      logger.error(`Fatal bulk envelope upload problem: ${description}`, logPayload);

      err.statusCode = 400;

      next(err);
    } else {
      logger.warn(`Bulk envelope upload problem: ${description}`, logPayload);
    }
  };

  // Handle a metadata/config.json entry.
  const handleConfigEntry = (entryPath, stream) => {
    jsonFromStream(stream, (err, config) => {
      if (err) return reportError(err, entryPath, 'parsing config.json');

      if (!config.contentIDBase) {
        let e = new Error('Missing required key: contentIDBase');
        return reportError(e, entryPath, 'parsing config.json');
      }

      contentIDBase = config.contentIDBase;
    });
  };

  // Handle a metadata/keep.json entry.
  const handleKeepEntry = (entryPath, stream) => {
    jsonFromStream(stream, (err, keep) => {
      if (err) return reportError(err, entryPath, 'parsing keep.json');

      if (!keep.keep) {
        let e = new Error('Missing required key: keep');
        return reportError(e, entryPath, 'parsing keep.json');
      }

      keep.keep.forEach((contentID) => {
        toKeep[contentID] = true;
      });
    });
  };

  const handleEnvelopeEntry = (entryPath, stream) => {
    let encodedContentID = path.basename(entryPath, '.json');
    let contentID = decodeURIComponent(encodedContentID);
    toKeep[contentID] = true;

    jsonFromStream(stream, (err, envelope) => {
      if (err) {
        failureCount++;
        return reportError(err, entryPath, 'parsing metadata envelope');
      }

      // TODO validate envelope contents against a schema

      uploadQueue.push({ contentID, envelope });
    });
  };

  const removeDeletedContent = (cb) => {
    if (!contentIDBase) {
      logger.debug('Skipping content deletion.');
      return cb(null);
    }

    let existingContentIDs = [];

    storage.listEnvelopes(contentIDBase, (err, doc) => {
      if (err) return cb(err);

      existingContentIDs.push(doc.contentID);
    }, (err) => {
      if (err) return cb(err);

      // All content consumed.
      let toDelete = existingContentIDs.filter((id) => !toKeep[id]);
      deletionCount = toDelete.length;

      logger.debug('Deleting removed envelopes.', { deletionCount });

      removeEnvelopes(toDelete, (err, results) => {
        if (err) return cb(err);

        logger.debug('Envelopes deleted.');

        cb();
      });
    });
  };

  const reportCompletion = () => {
    logger.info('Bulk content upload completed.', {
      action: 'bulkcontentstore',
      apikeyName: req.apikeyName,
      acceptedCount: envelopeCount,
      failedCount: failureCount,
      deletedCount: deletionCount,
      totalReqDuration: Date.now() - reqStart
    });

    let payload = { accepted: envelopeCount, failed: failureCount, deleted: deletionCount };
    let status = failureCount === 0 ? 200 : 500;

    res.send(status, payload);
    next();
  };

  const extract = tar.extract();

  extract.on('entry', (header, stream, next) => {
    if (header.type !== 'file') return next();
    const entryPath = header.name;

    const dirs = path.dirname(entryPath).split(path.sep);
    const dname = dirs[dirs.length - 1];
    const bname = path.basename(entryPath);

    logger.debug('Received entry for path', { entryPath });

    if (dname === 'metadata') {
      // metadata/ entries
      switch (bname) {
        case 'config.json':
          handleConfigEntry(entryPath, stream);
          break;
        case 'keep.json':
          handleKeepEntry(entryPath, stream);
          break;
        default:
          logger.warn('Unrecognized metadata entry', { entryPath });
          break;
      }
    } else if (bname.endsWith('.json')) {
      handleEnvelopeEntry(entryPath, stream);
    } else {
      logger.warn('Unrecognized entry', { entryPath });
    }

    next();
  });

  extract.on('error', (err) => {
    logger.info('Corrupted envelope tarball uploaded', {
      action: 'bulkcontentstore',
      apikey: req.apikeyName,
      err: err.message,
      stack: err.stack
    });

    res.send(400, err);

    next();
  });

  extract.on('finish', () => {
    const finishRequest = () => {
      removeDeletedContent((err) => {
        if (err) reportError(err, null, 'deleted content removal', true);

        reportCompletion();
      });
    };

    if (uploadQueue.running()) {
      uploadQueue.drain = finishRequest;
    } else {
      finishRequest();
    }
  });

  req.pipe(zlib.createGunzip()).pipe(extract);
};

const jsonFromStream = function (stream, callback) {
  let chunks = [];

  stream.on('data', (chunk) => chunks.push(chunk));
  stream.on('error', callback);
  stream.on('end', () => {
    try {
      let b = Buffer.concat(chunks, stream.size);
      let s = b.toString('utf-8');
      let payload = JSON.parse(s);
      return callback(null, payload);
    } catch (err) {
      return callback(err);
    }
  });
};
