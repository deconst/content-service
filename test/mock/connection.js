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
  var mockClient = {
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

  connection.client = mockClient;

  connection.contentContainer = {
    name: "the_content_container"
  };

  connection.assetContainer = {
    name: "the_asset_container",
    cdnSslUri: "https://example.com/fake/cdn/url"
  };

  var mockDB = {
    collections: {},

    addCollection: function (name, contents) {
      var collection = {
        find: function () { return collection; },
        insertOne: function (doc, callback) {
          contents.push(doc);

          if (callback) callback(null, mock_db);
        },
        deleteOne: function (filter, callback) {
          var resultIndex = -1;
          contents.forEach(function (each, index) {
            if (filter.apikey === each.apikey) {
              resultIndex = index;
            }
          });

          if (resultIndex !== -1) {
            contents.splice(resultIndex, 1);
          }

          if (callback) callback(null);
        },
        toArray: function (callback) {
          if (callback) callback(null, contents);
          return contents;
        }
      };
      this.collections[name] = collection;
    },

    collection: function (name) {
      if (!this.collections[name]) {
        this.addCollection(name, []);
      }
      return this.collections[name];
    }
  };

  connection.db = mockDB;

  return {
    mockClient: mockClient,
    mockDB: mockDB
  };
};
