/*
 * Mock the Rackspace and MongoDB connections.
 */

var
  mockClient = require("./client"),
  mockDatabase = require("./database");

exports.install = function (connection) {
  // Mock Rackspace Cloud Files client.
  connection.client = mockClient.create();

  connection.contentContainer = {
    name: "the_content_container"
  };

  connection.assetContainer = {
    name: "the_asset_container",
    cdnSslUri: "https://example.com/fake/cdn/url"
  };

  connection.db = mockDatabase.create();

  return {
    mockClient: connection.client,
    mockDB: connection.db
  };
};
