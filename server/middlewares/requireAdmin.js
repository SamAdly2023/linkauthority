const keys = require('../config/keys');

module.exports = (req, res, next) => {
  if (!req.user) {
    return res.status(401).send({ error: 'You must log in!' });
  }

  if (req.user.email !== keys.adminEmail) {
    return res.status(403).send({ error: 'Admin access required.' });
  }

  next();
};
