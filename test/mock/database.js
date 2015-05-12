// Mock basic MongoDB functionality.

var createResultSet = function (results) {
  return {
    toArray: function (callback) {
      if (callback) callback(null, results);
      return results;
    }
  };
};

var createMockCollection = function (db, contents) {
  return {
    find: function () { return createResultSet(contents); },
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
