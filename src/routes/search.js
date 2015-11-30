// Accept full-text search queries

exports.query = function (req, res, next) {
  res.send(200);
  next();
};
