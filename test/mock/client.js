// Mock pkgcloud functionality.

var
  util = require("util"),
  stream = require("stream"),
  Writable = stream.Writable,
  Readable = stream.Readable;

util.inherits(Sink, Writable);

function Sink(options) {
  Writable.call(this, options);
  var self = this;

  this._write = function (chunk, enc, next) {
    next();
  };

  this.on("finish", function () {
    self.emit("success");
  });
}

exports.create = function() {
  return {
    // Internal state, exposed for expectation-writing convenience.

    uploaded: [],
    downloaded: [],
    deleted: [],
    content: {},

    // Mocked pkgcloud client API.

    upload: function (params) {
      this.uploaded.push(params);
      return new Sink();
    },

    download: function (params) {
      this.downloaded.push(params);
      var rs = new Readable();
      rs.push(this.content[params.remote]);
      rs.push(null);

      rs.on('end', function () {
        rs.emit('complete', { statusCode: 200 });
      });

      return rs;
    },

    removeFile: function (container, name, callback) {
      this.deleted.push(name);
      delete this.content[name];
      callback(null);
    }
  };
};
