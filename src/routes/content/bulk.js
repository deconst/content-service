'use strict';

const async = require('async');
const path = require('path');
const zlib = require('zlib');
const tar = require('tar-stream');
const storage = require('../../storage');
const storeEnvelope = require('./store').storeEnvelope;
const removeEnvelopes = require('./remove').removeEnvelopes;

/**
 * @description Store new content into the content store from an uploaded tarball.
 */
exports.handler = function (req, res, next) {
  let contentIDBase = null;
  let envelopeCount = 0;
  let failureCount = 0;
  let deletionCount = 0;
  let toKeep = {};

  const envelopeWorker = (task, cb) => {
    req.logger.debug('Beginning envelope storage', {
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

      req.logger.debug('Envelope stored successfully', {
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
    const options = {
      payload: { entryPath },
      level: fatal ? 'error' : 'warn'
    };
    const message = (fatal ? 'Fatal b' : 'B') + `ulk envelope upload problem: ${description}`;

    req.logger.reportError(message, err, options);

    if (fatal) {
      err.statusCode = 400;
      next(err);
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
      req.logger.debug('No content ID base: Skipping content deletion.');
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

      req.logger.debug('Deleting removed envelopes.', { deletionCount });

      removeEnvelopes(toDelete, (err, results) => {
        if (err) return cb(err);

        req.logger.debug('Envelopes deleted.', { deletionCount });
        cb();
      });
    });
  };

  const reportCompletion = () => {
    let payload = { accepted: envelopeCount, failed: failureCount, deleted: deletionCount };
    let statusCode = failureCount === 0 ? 200 : 500;

    req.logger.reportSuccess('Bulk content upload completed.', {
      acceptedCount: envelopeCount,
      failedCount: failureCount,
      deletedCount: deletionCount,
      statusCode
    });

    res.send(statusCode, payload);
    next();
  };

  const extract = tar.extract();

  extract.on('entry', (header, stream, next) => {
    if (header.type !== 'file') return next();
    const entryPath = header.name;

    const dirs = path.dirname(entryPath).split(path.sep);
    const dname = dirs[dirs.length - 1];
    const bname = path.basename(entryPath);

    req.logger.debug('Received entry for path', { entryPath });

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
          req.logger.warn('Unrecognized metadata entry', { entryPath });
          break;
      }
    } else if (bname.endsWith('.json')) {
      handleEnvelopeEntry(entryPath, stream);
    } else {
      req.logger.warn('Unrecognized entry', { entryPath });
    }

    next();
  });

  extract.on('error', (err) => {
    req.logger.reportError('Corrupted envelope tarball uploaded', err, { statusCode: 400 });
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
