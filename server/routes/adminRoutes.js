const mongoose = require('mongoose');
const requireAdmin = require('../middlewares/requireAdmin');

const User = mongoose.model('User');
const Website = mongoose.model('Website');
const Transaction = mongoose.model('Transaction');

module.exports = app => {
  // Get All Users
  app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const users = await User.find({}).sort({ _id: -1 });
      res.send(users);
    } catch (err) {
      res.status(500).send(err);
    }
  });

  // Get All Websites
  app.get('/api/admin/websites', requireAdmin, async (req, res) => {
    try {
      const websites = await Website.find({}).populate('owner', 'name email');
      res.send(websites);
    } catch (err) {
      res.status(500).send(err);
    }
  });

  // Get All Transactions
  app.get('/api/admin/transactions', requireAdmin, async (req, res) => {
    try {
      const transactions = await Transaction.find({})
        .populate('user', 'name email')
        .sort({ timestamp: -1 });
      res.send(transactions);
    } catch (err) {
      res.status(500).send(err);
    }
  });

  // Update App Settings (Placeholder for now)
  app.post('/api/admin/settings', requireAdmin, async (req, res) => {
    // In a real app, you'd save this to a Settings model
    // For now, we'll just echo it back
    res.send({ message: 'Settings updated', settings: req.body });
  });
};
