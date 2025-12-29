const mongoose = require('mongoose');
const requireLogin = require('../middlewares/requireLogin');
const { estimateAuthority } = require('../services/ai');

const Website = mongoose.model('Website');
const User = mongoose.model('User');
const Transaction = mongoose.model('Transaction');

module.exports = app => {
  // Get all websites for marketplace (excluding own)
  app.get('/api/marketplace', async (req, res) => {
    // If user is logged in, exclude their sites
    const query = req.user ? { owner: { $ne: req.user._id } } : {};
    const sites = await Website.find(query).populate('owner', 'name');
    res.send(sites);
  });

  // Add a new website
  app.post('/api/websites', requireLogin, async (req, res) => {
    const { url, category } = req.body;

    // Basic validation
    if (!url) return res.status(400).send({ error: 'URL is required' });

    // Check if already exists
    const existing = await Website.findOne({ url });
    if (existing) return res.status(400).send({ error: 'Website already exists' });

    // AI Domain Authority calculation
    const domainAuthority = await estimateAuthority(url);

    const website = new Website({
      url,
      category,
      domainAuthority,
      owner: req.user._id,
      verified: true, // Auto-verify for now
      lastChecked: Date.now()
    });

    try {
      await website.save();
      
      // Add to user's websites list
      req.user.websites.push(website);
      await req.user.save();

      res.send(website);
    } catch (err) {
      res.status(422).send(err);
    }
  });

  // Buy a link (Transaction)
  app.post('/api/transaction', requireLogin, async (req, res) => {
    const { targetUrl, sourceUrl, cost } = req.body;

    if (req.user.points < cost) {
      return res.status(400).send({ error: 'Not enough points' });
    }

    // Find the seller (owner of targetUrl)
    const targetSite = await Website.findOne({ url: targetUrl }).populate('owner');
    if (!targetSite) return res.status(404).send({ error: 'Target site not found' });

    const seller = targetSite.owner;

    // Create Transaction Record
    const transaction = new Transaction({
      type: 'spend',
      points: cost,
      sourceUrl,
      targetUrl,
      user: req.user._id,
      status: 'completed'
    });

    try {
      // Deduct points from buyer
      req.user.points -= cost;
      await req.user.save();

      // Add points to seller
      seller.points += cost;
      await seller.save();

      // Save transaction
      await transaction.save();

      // Create a mirror transaction for the seller (earn)
      const earnTransaction = new Transaction({
        type: 'earn',
        points: cost,
        sourceUrl,
        targetUrl,
        user: seller._id,
        status: 'completed'
      });
      await earnTransaction.save();

      res.send({ user: req.user, transaction });
    } catch (err) {
      res.status(422).send(err);
    }
  });

  // Get User Transactions
  app.get('/api/transactions', requireLogin, async (req, res) => {
    const transactions = await Transaction.find({ user: req.user._id }).sort({ timestamp: -1 });
    res.send(transactions);
  });
};
