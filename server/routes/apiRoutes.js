const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const dns = require('dns').promises;
const requireLogin = require('../middlewares/requireLogin');
const { estimateAuthority } = require('../services/ai');
const { sendNotification } = require('../services/notification');
const { analyzeWebsite, getSEOAdvice } = require('../services/gemini');

const Website = mongoose.model('Website');
const User = mongoose.model('User');
const Transaction = mongoose.model('Transaction');

module.exports = app => {
  // Update User Profile
  app.put('/api/user', requireLogin, async (req, res) => {
    const { name, phone, avatar } = req.body;
    
    try {
      if (name) req.user.name = name;
      if (phone) req.user.phone = phone;
      if (avatar) req.user.avatar = avatar;
      
      await req.user.save();
      res.send(req.user);
    } catch (err) {
      res.status(422).send(err);
    }
  });

  // Get all websites for marketplace (excluding own)
  app.get('/api/marketplace', async (req, res) => {
    // If user is logged in, exclude their sites
    const query = req.user ? { owner: { $ne: req.user._id } } : {};
    const sites = await Website.find(query).populate('owner', 'name');
    res.send(sites);
  });

  // Add a new website
  app.post('/api/websites', requireLogin, async (req, res) => {
    const { url, category, serviceType, location } = req.body;

    // Basic validation
    if (!url) return res.status(400).send({ error: 'URL is required' });
    if (!category) return res.status(400).send({ error: 'Category is required' });

    // Check if already exists
    const existing = await Website.findOne({ url });
    if (existing) return res.status(400).send({ error: 'Website already exists' });

    // AI Domain Authority calculation (Keep this)
    const domainAuthority = await estimateAuthority(url);

    const isAdmin = req.user.email === 'samadly728@gmail.com';
    const verificationToken = crypto.randomBytes(16).toString('hex');

    const website = new Website({
      url,
      category,
      serviceType,
      location,
      domainAuthority,
      owner: req.user._id,
      isVerified: isAdmin, 
      verificationToken,
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

  // Update Website Details
  app.put('/api/websites/:id', requireLogin, async (req, res) => {
    const { category, serviceType, location } = req.body;
    
    try {
      const website = await Website.findOne({ _id: req.params.id, owner: req.user._id });
      if (!website) return res.status(404).send({ error: 'Website not found' });

      if (category) website.category = category;
      if (serviceType) website.serviceType = serviceType;
      if (location) website.location = location;

      await website.save();
      res.send(website);
    } catch (err) {
      res.status(422).send(err);
    }
  });

  // Verify website ownership
  app.post('/api/websites/verify', requireLogin, async (req, res) => {
    const { websiteId, method } = req.body;

    try {
      const website = await Website.findOne({ _id: websiteId, owner: req.user._id });
      if (!website) return res.status(404).send({ error: 'Website not found' });
      if (website.isVerified) return res.status(400).send({ error: 'Website already verified' });

      let verified = false;
      const domain = new URL(website.url).hostname;

      if (method === 'file') {
        const checkUrl = async (url) => {
            try {
                const response = await axios.get(`${url}/linkauthority-verification.txt`);
                return response.data.trim() === website.verificationToken;
            } catch (err) {
                return false;
            }
        };

        verified = await checkUrl(website.url);
        
        if (!verified) {
            // Try alternative (www vs non-www)
            const urlObj = new URL(website.url);
            let altUrl;
            if (urlObj.hostname.startsWith('www.')) {
                urlObj.hostname = urlObj.hostname.replace('www.', '');
                altUrl = urlObj.toString();
            } else {
                urlObj.hostname = `www.${urlObj.hostname}`;
                altUrl = urlObj.toString();
            }
            // Remove trailing slash if present to avoid double slash issues
            if (altUrl.endsWith('/')) {
                altUrl = altUrl.slice(0, -1);
            }
            verified = await checkUrl(altUrl);
        }
      } else if (method === 'dns') {
        try {
          const records = await dns.resolveTxt(domain);
          const tokenRecord = records.flat().find(r => r.includes(`linkauthority-verification=${website.verificationToken}`));
          if (tokenRecord) {
            verified = true;
          }
        } catch (err) {
          console.log('DNS verification failed:', err.message);
        }
      } else {
        return res.status(400).send({ error: 'Invalid verification method' });
      }

      if (verified) {
        website.isVerified = true;
        website.verificationMethod = method;
        website.verificationDate = Date.now();
        await website.save();
        res.send({ success: true, website });
      } else {
        res.status(400).send({ error: 'Verification failed. Please check your file or DNS record.' });
      }
    } catch (err) {
      res.status(500).send({ error: 'Verification process failed' });
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

      // Notify Seller
      sendNotification('TRANSACTION_CREATED', seller, {
        type: 'link_request',
        buyer: req.user.name,
        targetUrl: targetUrl,
        points: cost
      });

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

      // Update the related buyer transaction and notify buyer
      if (transaction.relatedTransactionId) {
        const buyerTransaction = await Transaction.findByIdAndUpdate(transaction.relatedTransactionId, { 
          status: 'completed',
          verificationUrl: verificationUrl
        }).populate('user');

        if (buyerTransaction && buyerTransaction.user) {
          sendNotification('TRANSACTION_VERIFIED', buyerTransaction.user, {
            type: 'link_verified',
            seller: req.user.name,
            verificationUrl: verificationUrl,
            targetUrl: transaction.sourceUrl
          });
        }
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

  // Get User Transactions
  app.get('/api/transactions', requireLogin, async (req, res) => {
    const transactions = await Transaction.find({ user: req.user._id }).sort({ timestamp: -1 });
    res.send(transactions);
  });

  // Get SEO Advice
  app.post('/api/seo-advice', requireLogin, async (req, res) => {
    const { url, da } = req.body;
    if (!url) return res.status(400).send({ error: 'URL is required' });

    try {
      const advice = await getSEOAdvice(url, da || 1);
      if (!advice) return res.status(500).send({ error: 'Failed to generate advice' });
      res.send(advice);
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Failed to generate advice' });
    }
  });
};
