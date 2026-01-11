const mongoose = require('mongoose');
const requireAdmin = require('../middlewares/requireAdmin');
const { analyzeWebsite } = require('../services/gemini');
const { sendEmail } = require('../services/email');

const User = mongoose.model('User');
const Website = mongoose.model('Website');
const Transaction = mongoose.model('Transaction');
const Notification = mongoose.model('Notification');

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

  // Verify Website
  app.post('/api/admin/websites/verify', requireAdmin, async (req, res) => {
    const { websiteId } = req.body;
    
    try {
      const website = await Website.findById(websiteId);
      if (!website) return res.status(404).send({ error: 'Website not found' });

      website.isVerified = true;
      website.verificationMethod = 'admin';
      website.verificationDate = Date.now();
      await website.save();

      res.send(website);
    } catch (err) {
      res.status(422).send(err);
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

  // -------------------------
  // COMMUNICATIONS
  // -------------------------
  
  // Send Email
  app.post('/api/admin/send-email', requireAdmin, async (req, res) => {
    const { type, userIds, subject, content } = req.body;
    
    let usersToEmail = [];
    
    try {
      if (type === 'all') {
        usersToEmail = await User.find({ email: { $exists: true, $ne: '' } });
      } else if (type === 'selected') {
        usersToEmail = await User.find({ _id: { $in: userIds } });
      } else if (type === 'single') {
        if (!userIds || userIds.length === 0) return res.status(400).send({ error: 'No user selected' });
        usersToEmail = await User.find({ _id: userIds[0] });
      }
      
      let successCount = 0;
      let failCount = 0;

      let lastError = null;

      const emailPromises = usersToEmail.map(async user => {
        if (!user.email) return;
        const result = await sendEmail(user.email, subject, content); 
        if (result.success) successCount++;
        else {
          failCount++;
          lastError = result.error;
        }
      });
      
      await Promise.all(emailPromises);
      
      if (successCount === 0 && failCount > 0) {
        return res.status(500).send({ error: `Failed to send all ${failCount} emails. Last Error: ${lastError}` });
      }

      res.send({ message: `Emails process complete. Sent: ${successCount}. Failed: ${failCount}` });
    } catch (err) {
      console.error("Email error:", err);
      res.status(500).send({ error: 'Failed to send emails' });
    }
  });

  // Send Notification (In-App)
  app.post('/api/admin/send-notification', requireAdmin, async (req, res) => {
    const { type, userIds, message } = req.body;
    
    try {
      let usersToNotify = [];
        if (type === 'all') {
        usersToNotify = await User.find({}, '_id'); 
      } else if (type === 'selected') {
        // userIds is an array of strings
        usersToNotify = userIds.map(id => ({ _id: id }));
      } else if (type === 'single') {
        if (!userIds || userIds.length === 0) return res.status(400).send({ error: 'No user selected' });
        usersToNotify = [{ _id: userIds[0] }];
      }

      const notifications = usersToNotify.map(u => ({
        recipient: u._id,
        message,
        read: false,
        createdAt: new Date(),
        type: 'info'
      }));
      
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
        res.send({ message: `Notifications sent to ${notifications.length} users` });
    } catch (err) {
        console.error("Notification error:", err);
      res.status(500).send({ error: 'Failed to send notifications' });
    }
  });
};
