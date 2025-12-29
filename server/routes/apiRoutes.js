const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');
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

    // Create Transaction Record for Buyer (Spend)
    const spendTransaction = new Transaction({
      type: 'spend',
      points: cost,
      sourceUrl,
      targetUrl,
      user: req.user._id,
      status: 'pending'
    });

    // Create Transaction Record for Seller (Earn)
    const earnTransaction = new Transaction({
      type: 'earn',
      points: cost,
      sourceUrl,
      targetUrl,
      user: seller._id,
      status: 'pending'
    });

    // Link them
    spendTransaction.relatedTransactionId = earnTransaction._id;
    earnTransaction.relatedTransactionId = spendTransaction._id;

    try {
      // Deduct points from buyer immediately (Escrow)
      req.user.points -= cost;
      await req.user.save();

      // Save transactions (Seller points are NOT added yet)
      await spendTransaction.save();
      await earnTransaction.save();

      res.send({ user: req.user, transaction: spendTransaction });
    } catch (err) {
      res.status(422).send(err);
    }
  });

  // Verify Link (New Endpoint)
  app.post('/api/transaction/verify', requireLogin, async (req, res) => {
    const { transactionId, verificationUrl } = req.body;

    try {
      const transaction = await Transaction.findById(transactionId).populate('user');
      if (!transaction) return res.status(404).send({ error: 'Transaction not found' });

      // Only the seller (who earns) can submit verification
      if (transaction.user._id.toString() !== req.user._id.toString()) {
        return res.status(403).send({ error: 'Unauthorized' });
      }

      if (transaction.type !== 'earn') {
        return res.status(400).send({ error: 'Only the earner can submit verification' });
      }

      if (transaction.status === 'completed') {
        return res.status(400).send({ error: 'Transaction already completed' });
      }

      // Fetch the verification URL
      const response = await axios.get(verificationUrl, {
        headers: { 'User-Agent': 'LinkAuthority-Bot/1.0' },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      
      // Check for link to sourceUrl (Buyer's site)
      // transaction.sourceUrl is the Buyer's site
      const normalize = (url) => url ? url.replace(/\/$/, '').toLowerCase() : '';
      const targetLink = normalize(transaction.sourceUrl);

      let found = false;
      $('a').each((i, link) => {
        const href = $(link).attr('href');
        const rel = $(link).attr('rel') || '';
        
        if (href && normalize(href).includes(targetLink)) {
          // Check for nofollow
          if (!rel.toLowerCase().includes('nofollow')) {
            found = true;
            return false; // break loop
          }
        }
      });

      if (!found) {
        return res.status(400).send({ error: `Dofollow backlink to ${transaction.sourceUrl} not found on the page.` });
      }

      // If found, complete the transaction
      transaction.status = 'completed';
      transaction.verificationUrl = verificationUrl;
      await transaction.save();

      // Credit the seller
      req.user.points += transaction.points;
      await req.user.save();

      // Update the related buyer transaction
      if (transaction.relatedTransactionId) {
        await Transaction.findByIdAndUpdate(transaction.relatedTransactionId, { 
          status: 'completed',
          verificationUrl: verificationUrl
        });
      }

      res.send({ transaction, user: req.user });

    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Verification failed. Could not fetch URL or parse content.' });
    }
  });

  // Buy Points (Mock Payment Endpoint)
  app.post('/api/buy-points', requireLogin, async (req, res) => {
    const { points, amount } = req.body;

    if (!points || !amount) return res.status(400).send({ error: 'Invalid request' });

    try {
      // In a real app, verify the PayPal payment ID here before crediting points
      
      req.user.points += points;
      
      // Record the transaction
      const transaction = new Transaction({
        type: 'earn', // Treated as earning for now
        points: points,
        sourceUrl: 'PayPal Purchase',
        targetUrl: 'System',
        user: req.user._id,
        status: 'completed'
      });

      await req.user.save();
      await transaction.save();

      res.send({ user: req.user, message: 'Points purchased successfully' });
    } catch (err) {
      res.status(500).send({ error: 'Purchase failed' });
    }
  });
};

  // Get User Transactions
  app.get('/api/transactions', requireLogin, async (req, res) => {
    const transactions = await Transaction.find({ user: req.user._id }).sort({ timestamp: -1 });
    res.send(transactions);
  });
};
