/*
 * Mock the Rackspace and MongoDB connections.
 */

var Writable = require("stream").Writable;

var sink = Writable();

sink._write = function (chunk, enc, next) {
  next();
};

exports.install = function (connection) {
  // Mock Rackspace Cloud Files client.
  var mock_client = {
    uploaded: [],
    upload: function (params) {
      this.uploaded.push(params);
      return sink;
    },
  };

  connection.client = mock_client;

  connection.asset_container = {
    cdnSslUri: "https://example.com/fake/cdn/url"
  };

  return {
    mock_client: mock_client
  };
};
