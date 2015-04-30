/*
 * Mock the Rackspace and MongoDB connections.
 */

var
  util = require("util"),
  Writable = require("stream").Writable;

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
    upload: function (params) {
      this.uploaded.push(params);
      return new Sink();
    },
  };

  connection.client = mock_client;

  connection.content_container = {
    name: "the_content_container"
  };

  connection.asset_container = {
    cdnSslUri: "https://example.com/fake/cdn/url"
  };

  return {
    mock_client: mock_client
  };
};
