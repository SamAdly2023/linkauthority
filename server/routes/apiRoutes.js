const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const dns = require('dns').promises;
const requireLogin = require('../middlewares/requireLogin');
const { estimateAuthority } = require('../services/ai');
const { sendNotification } = require('../services/notification');
const {
  sendWebsiteAddedEmail,
  sendWebsiteVerifiedEmail,
  sendLinkRequestEmail,
  sendLinkVerifiedEmail,
  sendAdminNotification,
  sendContactFormEmail
} = require('../services/email');
const { analyzeWebsite, getSEOAdvice } = require('../services/gemini');

const { db } = require('../services/firebase');
const { broadcastRefresh } = require('../services/partnerSync');

// Firestore helpers
const getWebsiteByUrl = async (url) => {
  const snap = await db.collection('websites').where('url', '==', url).limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, _id: snap.docs[0].id, ...snap.docs[0].data() };
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

const getTransactionById = async (id) => {
  const doc = await db.collection('transactions').doc(id).get();
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
      await db.collection('transactions').doc(id).set(toSave, { merge: true });
    }
  };
};

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

  // Contact Form Submission
  app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!email || !message) {
      return res.status(422).send({ error: 'Email and message are required' });
    }

    try {
      await sendContactFormEmail(name, email, subject || 'No Subject', message);
      res.send({ success: true, message: 'Message sent successfully' });
    } catch (err) {
      console.error('Contact form error:', err);
      res.status(500).send({ error: 'Failed to send message' });
    }
  });

  // Get all websites for marketplace (excluding own)
  app.get('/api/marketplace', async (req, res) => {
    try {
      let query = db.collection('websites');
      if (req.user) {
        query = query.where('ownerId', '!=', req.user.id);
      }
      const snap = await query.get();
      const sites = [];
      for (const doc of snap.docs) {
        const data = doc.data();
        const ownerDoc = await db.collection('users').doc(data.ownerId).get();
        const owner = ownerDoc.exists ? { name: ownerDoc.data().name } : { name: 'Unknown' };
        sites.push({
          id: doc.id,
          _id: doc.id,
          ...data,
          owner
        });
      }
      res.send(sites);
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Failed to fetch marketplace' });
    }
  });

  // Add a new website
  app.post('/api/websites', requireLogin, async (req, res) => {
    const { url, category, description, serviceType, location } = req.body;

    // Basic validation
    if (!url) return res.status(400).send({ error: 'URL is required' });
    if (!category) return res.status(400).send({ error: 'Category is required' });

    // Check if already exists
    const existing = await getWebsiteByUrl(url);
    if (existing) return res.status(400).send({ error: 'Website already exists' });

    // AI Domain Authority calculation (Keep this)
    const domainAuthority = await estimateAuthority(url);

    const isAdmin = req.user.email === 'samadly728@gmail.com';
    const verificationToken = crypto.randomBytes(16).toString('hex');

    const websiteId = db.collection('websites').doc().id;
    const websiteData = {
      url,
      category,
      description: description || '',
      serviceType,
      location: serviceType === 'local' ? location : null,
      domainAuthority,
      ownerId: req.user.id,
      isVerified: isAdmin,
      verificationToken,
      lastChecked: new Date(),
      createdAt: new Date()
    };

    try {
      await db.collection('websites').doc(websiteId).set(websiteData);

      const website = {
        id: websiteId,
        _id: websiteId,
        ...websiteData
      };

      // Email Notification
      sendWebsiteAddedEmail(req.user, website).catch(console.error);
      sendAdminNotification('New Website Added', `User ${req.user.name} added ${website.url} (DA: ${website.domainAuthority})`);

      res.send(website);
    } catch (err) {
      res.status(422).send(err);
    }
  });

  // Update Website Details
  app.put('/api/websites/:id', requireLogin, async (req, res) => {
    const { category, description, serviceType, location, logo } = req.body;

    try {
      const website = await getWebsiteById(req.params.id);
      if (!website || website.ownerId !== req.user.id) {
        return res.status(404).send({ error: 'Website not found' });
      }

      // The partner card other sites render is built from the logo + description,
      // so a change to either has to be pushed out to every connected plugin.
      const partnerCardChanged =
        (logo !== undefined && logo !== website.logo) ||
        (description !== undefined && description !== website.description);

      if (category) website.category = category;
      if (description !== undefined) website.description = description;
      if (serviceType) website.serviceType = serviceType;
      if (location) website.location = location;
      if (logo !== undefined) website.logo = logo;

      await website.save();
      res.send(website);

      // Without this the edit only reaches other sites on their next hourly cron,
      // because each plugin caches the directory and bakes it into the page content.
      if (partnerCardChanged && website.isActive) {
        broadcastRefresh(website.id).catch(err => console.error('broadcastRefresh (website update) failed:', err.message));
      }
    } catch (err) {
      res.status(422).send(err);
    }
  });

  // Verify website ownership
  app.post('/api/websites/verify', requireLogin, async (req, res) => {
    const { websiteId, method } = req.body;

    try {
      const website = await getWebsiteById(websiteId);
      if (!website || website.ownerId !== req.user.id) {
        return res.status(404).send({ error: 'Website not found' });
      }
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
        website.verificationDate = new Date();
        await website.save();

        // Email Notification
        sendWebsiteVerifiedEmail(req.user, website).catch(console.error);
        sendAdminNotification('Website Verified', `User ${req.user.name} verified ${website.url}`);

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
    const targetSite = await getWebsiteByUrl(targetUrl);
    if (!targetSite) return res.status(404).send({ error: 'Target site not found' });

    const seller = await getUserById(targetSite.ownerId);
    if (!seller) return res.status(404).send({ error: 'Seller not found' });

    const spendTxId = db.collection('transactions').doc().id;
    const earnTxId = db.collection('transactions').doc().id;

    // Create Transaction Record for Buyer (Spend)
    const spendTransactionData = {
      type: 'spend',
      points: cost,
      sourceUrl,
      targetUrl,
      userId: req.user.id,
      status: 'pending',
      timestamp: new Date(),
      relatedTransactionId: earnTxId
    };

    // Create Transaction Record for Seller (Earn)
    const earnTransactionData = {
      type: 'earn',
      points: cost,
      sourceUrl,
      targetUrl,
      userId: seller.id,
      status: 'pending',
      timestamp: new Date(),
      relatedTransactionId: spendTxId
    };

    try {
      // Deduct points from buyer immediately (Escrow)
      req.user.points -= cost;
      await req.user.save();

      // Check if Target Site has Widget Installed (Auto-Verify)
      if (targetSite.widgetActive) {
        spendTransactionData.status = 'completed';
        spendTransactionData.verificationUrl = 'Widget Auto-Verification';

        earnTransactionData.status = 'completed';
        earnTransactionData.verificationUrl = 'Widget Auto-Verification';

        // Credit Seller Immediately
        seller.points += cost;
        await seller.save();

        // Notify Buyer (Instant Success)
        sendNotification('TRANSACTION_COMPLETED', req.user, {
          type: 'link_verified',
          seller: seller.name,
          points: cost,
          sourceUrl: sourceUrl
        });
      }

      // Save transactions
      await db.collection('transactions').doc(spendTxId).set(spendTransactionData);
      await db.collection('transactions').doc(earnTxId).set(earnTransactionData);

      const spendTransaction = { id: spendTxId, _id: spendTxId, ...spendTransactionData };

      if (targetSite.widgetActive) {
        // Notify Seller (New Active Link)
        sendNotification('TRANSACTION_CREATED', seller, {
          type: 'info',
          message: `New Instant Backlink! ${req.user.name} placed a link on ${targetUrl}. It is live via your widget.`
        });
      } else {
        // Validation/Manual Flow
        sendNotification('TRANSACTION_CREATED', seller, {
          type: 'link_request',
          buyer: req.user.name,
          targetUrl: targetUrl,
          points: cost
        });

        // Notify Seller (Email)
        sendLinkRequestEmail(seller, req.user.name, spendTransaction).catch(console.error);
      }

      res.send({ user: req.user, transaction: spendTransaction });
    } catch (err) {
      console.error(err);
      res.status(422).send(err);
    }
  });

  // Verify Script Installation (New Method)
  app.post('/api/websites/verify-script', requireLogin, async (req, res) => {
    const { websiteId } = req.body;

    try {
      const website = await getWebsiteById(websiteId);
      if (!website || website.ownerId !== req.user.id) {
        return res.status(404).send({ error: 'Website not found' });
      }

      // Fetch the homepage
      const response = await axios.get(website.url, {
        headers: { 'User-Agent': 'LinkAuthority-Bot/1.0' },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const scriptSelector = `script[src*="widget.js"][data-id="${website.id}"]`;
      const scriptFound = $(scriptSelector).length > 0;

      if (scriptFound) {
        website.isVerified = true;
        website.verificationMethod = 'script';
        website.verificationDate = new Date();
        website.widgetActive = true;
        await website.save();

        sendWebsiteVerifiedEmail(req.user, website).catch(console.error);
        res.send(website);
      } else {
        res.status(400).send({ error: 'Widget script not found. Please ensure you added the code to your homepage.' });
      }
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Verification failed. Could not access website.' });
    }
  });

  // Public Widget Endpoint - Get Links to Display
  app.get('/api/widget/:websiteId/links', async (req, res) => {
    const { websiteId } = req.params;

    try {
      const website = await getWebsiteById(websiteId);
      if (!website) return res.status(404).send({ error: 'Site not found' });

      // Find all COMPLETED transactions where this site is the TARGET (Seller)
      const transSnap = await db.collection('transactions')
        .where('targetUrl', '==', website.url)
        .where('type', '==', 'earn')
        .where('status', 'in', ['completed', 'active'])
        .get();

      const transactions = transSnap.docs.map(doc => doc.data());

      // Fetch descriptions for the source URLs
      const links = [];
      for (const t of transactions) {
        const sourceSite = await getWebsiteByUrl(t.sourceUrl);
        links.push({
          url: t.sourceUrl,
          text: t.anchorText || t.sourceUrl,
          description: sourceSite ? sourceSite.description : '',
          rel: 'dofollow'
        });
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(links);
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Server error' });
    }
  });

  // Verify Link (New Endpoint)
  app.post('/api/transaction/verify', requireLogin, async (req, res) => {
    const { transactionId, verificationUrl } = req.body;

    try {
      const transaction = await getTransactionById(transactionId);
      if (!transaction) return res.status(404).send({ error: 'Transaction not found' });

      // Only the seller (who earns) can submit verification
      if (transaction.userId !== req.user.id) {
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
      const normalize = (url) => url ? url.replace(/\/$/, '').toLowerCase() : '';
      const targetLink = normalize(transaction.sourceUrl);

      let found = false;
      $('a').each((i, link) => {
        const href = $(link).attr('href');
        const rel = $(link).attr('rel') || '';

        if (href && normalize(href).includes(targetLink)) {
          if (!rel.toLowerCase().includes('nofollow')) {
            found = true;
            return false;
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
        const buyerTx = await getTransactionById(transaction.relatedTransactionId);
        if (buyerTx) {
          buyerTx.status = 'completed';
          buyerTx.verificationUrl = verificationUrl;
          await buyerTx.save();

          const buyerUser = await getUserById(buyerTx.userId);
          if (buyerUser) {
            sendNotification('TRANSACTION_VERIFIED', buyerUser, {
              type: 'link_verified',
              seller: req.user.name,
              verificationUrl: verificationUrl,
              targetUrl: transaction.sourceUrl
            });

            sendLinkVerifiedEmail(buyerUser, req.user.name, buyerTx).catch(console.error);
          }
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
      req.user.points += points;

      const transactionId = db.collection('transactions').doc().id;
      const transactionData = {
        type: 'earn',
        points: points,
        amount: parseFloat(amount),
        sourceUrl: 'PayPal Purchase',
        targetUrl: 'System',
        userId: req.user.id,
        status: 'completed',
        timestamp: new Date()
      };

      await req.user.save();
      await db.collection('transactions').doc(transactionId).set(transactionData);

      res.send({ user: req.user, message: 'Points purchased successfully' });
    } catch (err) {
      res.status(500).send({ error: 'Purchase failed' });
    }
  });

  // Get User Transactions
  app.get('/api/transactions', requireLogin, async (req, res) => {
    try {
      const snap = await db.collection('transactions')
        .where('userId', '==', req.user.id)
        .orderBy('timestamp', 'desc')
        .get();
      const transactions = snap.docs.map(doc => ({ id: doc.id, _id: doc.id, ...doc.data() }));
      res.send(transactions);
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Failed to fetch transactions' });
    }
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

  // Get Notifications
  app.get('/api/notifications', requireLogin, async (req, res) => {
    try {
      const snap = await db.collection('notifications')
        .where('recipientId', '==', req.user.id)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();
      const notifications = snap.docs.map(doc => ({ id: doc.id, _id: doc.id, ...doc.data() }));
      res.send(notifications);
    } catch (err) {
      res.status(500).send(err);
    }
  });

  // Mark notifications read
  app.post('/api/notifications/mark-read', requireLogin, async (req, res) => {
    try {
      const { id } = req.body;
      if (id) {
        await db.collection('notifications').doc(id).update({ read: true });
      } else {
        const snap = await db.collection('notifications')
          .where('recipientId', '==', req.user.id)
          .where('read', '==', false)
          .get();

        const batch = db.batch();
        snap.docs.forEach(doc => {
          batch.update(doc.ref, { read: true });
        });
        await batch.commit();
      }
      res.send({ success: true });
    } catch (err) {
      res.status(500).send(err);
    }
  });

  // Serve assigned links for a site token (used by WP plugin & JS snippet)
  app.get('/api/integration/links', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send({ error: 'Token is required' });

    try {
      const webSnap = await db.collection('websites').where('verificationToken', '==', token).limit(1).get();
      if (webSnap.empty) return res.status(404).send({ error: 'Invalid token or site not found' });
      const website = { id: webSnap.docs[0].id, ...webSnap.docs[0].data() };

      const transSnap = await db.collection('transactions')
        .where('targetUrl', '==', website.url)
        .where('type', '==', 'earn')
        .where('status', 'in', ['completed', 'active'])
        .get();

      const transactions = transSnap.docs.map(doc => doc.data());
      const links = [];

      for (const t of transactions) {
        const sourceSite = await getWebsiteByUrl(t.sourceUrl);
        links.push({
          url: t.sourceUrl,
          title: sourceSite ? (sourceSite.name || sourceSite.url.replace(/https?:\/\/(www\.)?/, '')) : t.sourceUrl,
          description: sourceSite ? (sourceSite.description || 'Quality partner backlink') : 'Quality partner backlink'
        });
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(links);
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Failed to retrieve links' });
    }
  });

  // Verify integration (Wordpress Rest ping or HTML crawl fallback)
  app.post('/api/websites/verify-integration', requireLogin, async (req, res) => {
    const { websiteId, customUrl } = req.body;

    try {
      const website = await getWebsiteById(websiteId);
      if (!website || website.ownerId !== req.user.id) {
        return res.status(404).send({ error: 'Website not found' });
      }

      let verified = false;
      let integrationType = 'none';

      // 1. Try WP REST update check first
      const wpApiUrl = `${website.url.replace(/\/$/, '')}/wp-json/linkauthority/v1/update`;
      try {
        const wpResponse = await axios.post(wpApiUrl, { token: website.verificationToken }, { timeout: 5000 });
        if (wpResponse.status === 200 && wpResponse.data.success !== undefined) {
          verified = true;
          integrationType = 'wordpress';
        }
      } catch (err) {
        // Not WP or plugin not active yet - fall back
      }

      // 2. Fall back to crawling HTML for partners page
      if (!verified) {
        const pageUrl = customUrl || `${website.url.replace(/\/$/, '')}/partners`;
        try {
          const pageResponse = await axios.get(pageUrl, {
            headers: { 'User-Agent': 'LinkAuthority-Bot/1.0' },
            timeout: 10000
          });
          const $ = cheerio.load(pageResponse.data);

          const widgetContainer = $('#linkauthority-partners-widget').length > 0;
          const wpContainer = $('.linkauthority-partners-silo').length > 0;
          const scriptFound = $(`script[src*="widget.js"]`).length > 0;

          if (widgetContainer || wpContainer || scriptFound) {
            verified = true;
            integrationType = scriptFound ? 'script' : 'wordpress';
            await db.collection('websites').doc(websiteId).update({ partnersPageUrl: pageUrl });
          }
        } catch (crawlErr) {
          console.log("Crawl fallback failed:", crawlErr.message);
        }
      }

      if (verified) {
        await db.collection('websites').doc(websiteId).update({
          isVerified: true,
          verificationMethod: integrationType,
          verificationDate: new Date(),
          widgetActive: true
        });

        const updatedWebsite = await getWebsiteById(websiteId);
        res.send({ success: true, website: updatedWebsite });
      } else {
        res.status(400).send({ 
          error: 'Integration not found. Please activate the WP plugin or insert the JS snippet first.' 
        });
      }
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Integration verification failed' });
    }
  });
};
