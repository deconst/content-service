// Mock basic MongoDB functionality.

var _ = require('lodash');

var createResultSet = function (results) {
  var contents = results;

  return {
    sort: function (attr) {
      return this;
    },

    toArray: function (callback) {
      if (callback) callback(null, contents);
      return contents;
    },

    map: function (transform) {
      contents = contents.map(transform);
      return null;
    }
  };
};

var createMockCollection = function (db, contents) {
  var singleMatch = function (actual, expected) {
    if (! actual || ! expected) return false;

    return actual === expected;
  };

  var arrayMatch = function (haystack, needle) {
    if (! haystack || ! needle) return false;

    return _.some(haystack, function (each) { return each === needle; });
  };

  return {
    find: function (query) {
      if (!query) {
        return createResultSet(contents);
      }

      var results = [];
      for (var i = 0; i < contents.length; i++) {
        var each = contents[i];

        var match =
          singleMatch(each.apikey, query.apikey) ||
          arrayMatch(each.categories, query.categories) ||
          arrayMatch(each.tags, query.tags);

        if (match) results.push(each);
      }

      return createResultSet(results);
    },

    findOneAndReplace: function (query, replacement, options, callback) {
      var
        results = [],
        resultIndex = -1;

      for (var i = 0; i < contents.length; i++) {
        var each = contents[i];

        var match =
          singleMatch(each.contentID, query.contentID);

        if (match) {
          results.push(each);
          resultIndex = i;
        }
      }

      if (results.length > 1) {
        console.error("Query results:", results);

        return callback(new Error("Expected a single result but found multiple."));
      }

      if (resultIndex === -1) {
        if (options.upsert) {
          contents.push(replacement);
          callback(null, replacement);
        } else {
          callback(null, null);
        }
      } else {
        contents[resultIndex] = replacement;
        callback(null, replacement);
      }
    },

    insertOne: function (doc, callback) {
      contents.push(doc);

      if (callback) callback(null, db);
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
    }
  };
};

exports.create = function () {
  return {
    // Internal state, exposed for expectation-writing convenience.

    collections: {},

    // Mocked MongoDB client API.

    collection: function (name) {
      if (!this.collections[name]) {
        this.addCollection(name, []);
      }
      return this.collections[name];
    },

    // Convenience methods for tests themselves.

    addCollection: function (name, contents) {
      this.collections[name] = createMockCollection(this, contents);
    }
  };
};
