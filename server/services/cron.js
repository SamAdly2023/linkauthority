const { db } = require('./firebase');
const axios = require('axios');
const cheerio = require('cheerio');
const { sendNotification } = require('./notification');

const verifyAndProcessCredits = async () => {
  console.log("CRON: Starting daily backlink verification and point calculations...");
  try {
    const webSnap = await db.collection('websites').where('isVerified', '==', true).get();
    const websites = webSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    for (const site of websites) {
      const partnersPage = site.partnersPageUrl || `${site.url.replace(/\/$/, '')}/partners`;
      
      const transSnap = await db.collection('transactions')
        .where('targetUrl', '==', site.url)
        .where('type', '==', 'earn')
        .where('status', 'in', ['completed', 'active'])
        .get();

      const transactions = transSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (transactions.length === 0) continue;

      let pageHtml = '';
      let isAccessible = false;

      try {
        const response = await axios.get(partnersPage, {
          headers: { 'User-Agent': 'LinkAuthority-Bot/1.0' },
          timeout: 15000
        });
        pageHtml = response.data;
        isAccessible = true;
      } catch (err) {
        console.warn(`CRON: Failed to access partners page for ${site.url}:`, err.message);
      }

      const $ = isAccessible ? cheerio.load(pageHtml) : null;

      for (const t of transactions) {
        let isLinkValid = false;

        if (isAccessible && $) {
          $('a').each((i, link) => {
            const href = $(link).attr('href');
            const rel = $(link).attr('rel') || '';
            const normalizedHref = href ? href.replace(/\/$/, '').toLowerCase() : '';
            const targetHref = t.sourceUrl.replace(/\/$/, '').toLowerCase();

            if (href && normalizedHref.includes(targetHref) && !rel.includes('nofollow')) {
              isLinkValid = true;
            }
          });
        }

        const buyerDoc = await db.collection('users').doc(t.userId).get();
        const sellerDoc = await db.collection('users').doc(site.ownerId).get();

        if (!buyerDoc.exists || !sellerDoc.exists) continue;

        const buyer = { id: buyerDoc.id, ...buyerDoc.data() };
        const seller = { id: sellerDoc.id, ...sellerDoc.data() };

        const earnRate = parseFloat((site.domainAuthority * 0.1).toFixed(2));
        const costRate = parseFloat((site.domainAuthority * 0.12).toFixed(2));

        if (isLinkValid) {
          if (buyer.points >= costRate) {
            buyer.points = parseFloat((buyer.points - costRate).toFixed(2));
            seller.points = parseFloat((seller.points + earnRate).toFixed(2));

            await db.collection('users').doc(buyer.id).set({ points: buyer.points }, { merge: true });
            await db.collection('users').doc(seller.id).set({ points: seller.points }, { merge: true });

            console.log(`CRON: Processed daily points. Buyer ${buyer.email} -${costRate}. Seller ${seller.email} +${earnRate}`);
          } else {
            await db.collection('transactions').doc(t.id).update({ status: 'suspended' });
            if (t.relatedTransactionId) {
              await db.collection('transactions').doc(t.relatedTransactionId).update({ status: 'suspended' });
            }

            console.log(`CRON: Suspended link ${t.sourceUrl} -> ${site.url} due to insufficient buyer points`);
            
            sendNotification('TRANSACTION_SUSPENDED', buyer, {
              type: 'info',
              message: `Your link placement on ${site.url} has been suspended due to insufficient points. Please buy credits to reactivate.`
            });
          }
        } else {
          await db.collection('transactions').doc(t.id).update({ status: 'missing' });
          if (t.relatedTransactionId) {
            await db.collection('transactions').doc(t.relatedTransactionId).update({ status: 'missing' });
          }

          console.log(`CRON: Link not found or nofollow on ${partnersPage} for ${t.sourceUrl}`);

          sendNotification('LINK_MISSING', seller, {
            type: 'warning',
            message: `The partner link to ${t.sourceUrl} was not found on your Partners page. Please restore it to continue earning points.`
          });
        }
      }
    }
  } catch (err) {
    console.error("CRON Error:", err);
  }
};

const { checkReciprocity } = require('./reciprocity');

const startCron = () => {
  // Trigger verification 2 minutes after start, then every 24 hours
  setTimeout(verifyAndProcessCredits, 120000);
  setInterval(verifyAndProcessCredits, 24 * 60 * 60 * 1000);

  // Reciprocity sweep, offset from the credits run so the two don't crawl at
  // the same time.
  setTimeout(checkReciprocity, 10 * 60 * 1000);
  setInterval(checkReciprocity, 24 * 60 * 60 * 1000);
};

module.exports = { startCron, verifyAndProcessCredits, checkReciprocity };
