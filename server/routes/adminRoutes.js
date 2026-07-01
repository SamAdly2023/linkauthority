const requireAdmin = require('../middlewares/requireAdmin');
const { analyzeWebsite } = require('../services/gemini');
const { sendEmail } = require('../services/email');

const { db } = require('../services/firebase');

// Helper to get user wrapper
const getUserById = async (id) => {
  const doc = await db.collection('users').doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    id: doc.id,
    _id: doc.id,
    ...data,
    save: async function() {
      const toSave = { ...this };
      delete toSave.save;
      delete toSave.id;
      delete toSave._id;
      await db.collection('users').doc(id).set(toSave, { merge: true });
    }
  };
};

const getWebsiteById = async (id) => {
  const doc = await db.collection('websites').doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    id: doc.id,
    _id: doc.id,
    ...data,
    save: async function() {
      const toSave = { ...this };
      delete toSave.save;
      delete toSave.id;
      delete toSave._id;
      await db.collection('websites').doc(id).set(toSave, { merge: true });
    }
  };
};

module.exports = app => {
  // Re-analyze all websites
  app.post('/api/admin/reanalyze-all', requireAdmin, async (req, res) => {
    try {
      const websitesSnap = await db.collection('websites').get();
      let count = 0;

      for (const doc of websitesSnap.docs) {
        const site = { id: doc.id, ...doc.data() };
        try {
          const aiData = await analyzeWebsite(site.url);
          await db.collection('websites').doc(site.id).update({
            category: aiData.category,
            serviceType: aiData.serviceType,
            location: aiData.location
          });
          count++;
        } catch (err) {
          console.error(`Failed to re-analyze ${site.url}:`, err);
        }
      }

      res.send({ message: `Successfully re-analyzed ${count} websites.` });
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Failed to re-analyze websites' });
    }
  });

  // Get All Users
  app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const usersSnap = await db.collection('users').get();
      const users = usersSnap.docs.map(doc => ({ id: doc.id, _id: doc.id, ...doc.data() }));
      // Sort by creation or ID desc (we can do it in memory)
      users.sort((a, b) => b.id.localeCompare(a.id));
      res.send(users);
    } catch (err) {
      res.status(500).send(err);
    }
  });

  // Add Points to User
  app.post('/api/admin/users/points', requireAdmin, async (req, res) => {
    const { userId, points } = req.body;

    try {
      const user = await getUserById(userId);
      if (!user) return res.status(404).send({ error: 'User not found' });

      user.points += parseInt(points);
      await user.save();

      // Create a transaction record for this manual adjustment
      const transactionId = db.collection('transactions').doc().id;
      const transactionData = {
        type: 'earn',
        points: parseInt(points),
        sourceUrl: 'Admin Adjustment',
        targetUrl: 'System',
        userId: userId,
        status: 'completed',
        timestamp: new Date()
      };
      await db.collection('transactions').doc(transactionId).set(transactionData);

      res.send(user);
    } catch (err) {
      console.error(err);
      res.status(422).send(err);
    }
  });

  // Get All Websites
  app.get('/api/admin/websites', requireAdmin, async (req, res) => {
    try {
      const websitesSnap = await db.collection('websites').get();
      const websites = [];
      for (const doc of websitesSnap.docs) {
        const data = doc.data();
        const ownerDoc = await db.collection('users').doc(data.ownerId).get();
        const owner = ownerDoc.exists ? { name: ownerDoc.data().name, email: ownerDoc.data().email } : { name: 'Unknown', email: 'Unknown' };
        websites.push({
          id: doc.id,
          _id: doc.id,
          ...data,
          owner
        });
      }
      res.send(websites);
    } catch (err) {
      res.status(500).send(err);
    }
  });

  // Verify Website
  app.post('/api/admin/websites/verify', requireAdmin, async (req, res) => {
    const { websiteId } = req.body;

    try {
      const website = await getWebsiteById(websiteId);
      if (!website) return res.status(404).send({ error: 'Website not found' });

      website.isVerified = true;
      website.verificationMethod = 'admin';
      website.verificationDate = new Date();
      await website.save();

      res.send(website);
    } catch (err) {
      res.status(422).send(err);
    }
  });

  // Delete Website
  app.delete('/api/admin/websites/:id', requireAdmin, async (req, res) => {
    try {
      await db.collection('websites').doc(req.params.id).delete();
      res.send({ message: 'Website deleted successfully' });
    } catch (err) {
      res.status(500).send({ error: 'Failed to delete website' });
    }
  });

  // Get All Transactions
  app.get('/api/admin/transactions', requireAdmin, async (req, res) => {
    try {
      const transactionsSnap = await db.collection('transactions').get();
      const transactions = [];

      for (const doc of transactionsSnap.docs) {
        const data = doc.data();
        const ownerDoc = await db.collection('users').doc(data.userId).get();
        const user = ownerDoc.exists ? { name: ownerDoc.data().name, email: ownerDoc.data().email } : { name: 'Unknown', email: 'Unknown' };

        // Convert Timestamp to JS Date or string if necessary for frontend
        const timestamp = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate() : data.timestamp;

        transactions.push({
          id: doc.id,
          _id: doc.id,
          ...data,
          timestamp,
          user
        });
      }

      transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.send(transactions);
    } catch (err) {
      console.error(err);
      res.status(500).send(err);
    }
  });

  // Update App Settings
  app.post('/api/admin/settings', requireAdmin, async (req, res) => {
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
        const snap = await db.collection('users').get();
        usersToEmail = snap.docs.map(doc => doc.data()).filter(u => u.email);
      } else if (type === 'selected') {
        usersToEmail = [];
        for (const id of userIds) {
          const uDoc = await db.collection('users').doc(id).get();
          if (uDoc.exists && uDoc.data().email) {
            usersToEmail.push(uDoc.data());
          }
        }
      } else if (type === 'single') {
        if (!userIds || userIds.length === 0) return res.status(400).send({ error: 'No user selected' });
        const uDoc = await db.collection('users').doc(userIds[0]).get();
        if (uDoc.exists && uDoc.data().email) {
          usersToEmail.push(uDoc.data());
        }
      }

      let successCount = 0;
      let failCount = 0;
      let lastError = null;

      const emailPromises = usersToEmail.map(async user => {
        if (!user.email) return;
        const result = await sendEmail(user.email, subject, content, [], user.name);
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
        const snap = await db.collection('users').get();
        usersToNotify = snap.docs.map(doc => doc.id);
      } else if (type === 'selected') {
        usersToNotify = userIds;
      } else if (type === 'single') {
        if (!userIds || userIds.length === 0) return res.status(400).send({ error: 'No user selected' });
        usersToNotify = [userIds[0]];
      }

      const batch = db.batch();
      usersToNotify.forEach(uid => {
        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
          recipientId: uid,
          message,
          read: false,
          createdAt: new Date(),
          type: 'info'
        });
      });

      await batch.commit();
      res.send({ message: `Notifications sent to ${usersToNotify.length} users` });
    } catch (err) {
      console.error("Notification error:", err);
      res.status(500).send({ error: 'Failed to send notifications' });
    }
  });
};
