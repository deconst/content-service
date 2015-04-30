/*
 * Unit tests for the /version endpoint.
 */

var
  request = require("supertest"),
  config = require("../src/config"),
  server = require("../src/server");

describe("/version", function () {
  it("reports service information", function (done) {
    request(server.create())
      .get("/version")
      .expect(200)
      .expect("Content-Type", "application/json")
      .expect({
        service: config.info.name,
        version: config.info.version,
        commit: config.commit
      }, done);
  });
});
