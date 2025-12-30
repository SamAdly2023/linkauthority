const mongoose = require('mongoose');
const requireAdmin = require('../middlewares/requireAdmin');
const { analyzeWebsite } = require('../services/gemini');

const User = mongoose.model('User');
const Website = mongoose.model('Website');
const Transaction = mongoose.model('Transaction');

module.exports = app => {
  // Re-analyze all websites
  app.post('/api/admin/reanalyze-all', requireAdmin, async (req, res) => {
    try {
      const websites = await Website.find({});
      let count = 0;
      
      // Process in background to avoid timeout, but for now we'll await to show progress
      // In production, use a job queue
      for (const site of websites) {
        try {
          const aiData = await analyzeWebsite(site.url);
          site.category = aiData.category;
          site.serviceType = aiData.serviceType;
          site.location = aiData.location;
          await site.save();
          count++;
        } catch (err) {
          console.error(`Failed to re-analyze ${site.url}:`, err);
        }
      }
      
      res.send({ message: `Successfully re-analyzed ${count} websites.` });
    } catch (err) {
      res.status(500).send({ error: 'Failed to re-analyze websites' });
    }
  });

  // Get All Users
  app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const users = await User.find({}).sort({ _id: -1 });
      res.send(users);
    } catch (err) {
      res.status(500).send(err);
    }
  });

  // Add Points to User
  app.post('/api/admin/users/points', requireAdmin, async (req, res) => {
    const { userId, points } = req.body;
    
    try {
      const user = await User.findById(userId);
      if (!user) return res.status(404).send({ error: 'User not found' });

      user.points += parseInt(points);
      await user.save();

      // Create a transaction record for this manual adjustment
      const transaction = new Transaction({
        type: 'earn',
        points: parseInt(points),
        sourceUrl: 'Admin Adjustment',
        targetUrl: 'System',
        user: userId,
        status: 'completed'
      });
      await transaction.save();

      res.send(user);
    } catch (err) {
      res.status(422).send(err);
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
