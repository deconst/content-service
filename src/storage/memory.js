/**
 * @description Storage driver that uses entirely in-memory data structures.
 *
 * This is useful for unit testing and for local builds.
 */
 function MemoryStorage() {}

 MemoryStorage.prototype.setup = function (callback) {
   this.envelopes = {};
   this.keys = {};

   callback();
 }

 module.exports = {
   MemoryStorage: MemoryStorage
 },
