/*
 * Unit tests for API key management.
 */

var
  request = require("supertest"),
  expect = require("chai").expect,
  config = require("../src/config"),
  server = require("../src/server");

describe("/key", function () {
  describe("POST", function () {
    it("requires authentication");
    it("allows an admin to issue a new key");
    it("prevents non-admins from issuing keys");
  });

  describe("DELETE", function () {
    it("requires authentication");
    it("allows an admin to revoke an existing key");
    it("prevents non-admins from revoking keys");
    it("doesn't allow admins to revoke their own key");
  });
});
