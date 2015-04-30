/*
 * Mock the Rackspace and MongoDB connections.
 */

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

exports.install = function (connection) {
  // Mock Rackspace Cloud Files client.
  var mock_client = {
    uploaded: [],
    downloaded: [],
    deleted: [],
    content: {},

    upload: function (params) {
      this.uploaded.push(params);
      return new Sink();
    },

    download: function (params) {
      this.downloaded.push(params);
      var rs = new Readable();
      rs.push(this.content[params.remote]);
      rs.push(null);
      return rs;
    },

    removeFile: function (container, name, callback) {
      this.deleted.push(name);
      delete this.content[name];
      callback(null);
    }
  };

  connection.client = mock_client;

  connection.content_container = {
    name: "the_content_container"
  };

  connection.asset_container = {
    name: "the_asset_container",
    cdnSslUri: "https://example.com/fake/cdn/url"
  };

  var mock_db = {
    collections: {},

    add_collection: function (name, contents) {
      var collection = {
        find: function () { return collection; },
        toArray: function (callback) { callback(null, contents); }
      };
      this.collections[name] = collection;
    },

    collection: function (name) {
      if (!this.collections[name]) {
        this.add_collection(name, []);
      }
      return this.collections[name];
    }
  };

  connection.db = mock_db;

  return {
    mock_client: mock_client,
    mock_db: mock_db
  };
};
