const nodemailer = require('nodemailer');
const keys = require('../config/keys');
const path = require('path');

const transporter = nodemailer.createTransport({
  host: "s5531.usc1.stableserver.net",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: keys.emailUser,
    pass: keys.emailPass
  },
  tls: {
    rejectUnauthorized: false
  },
  logger: true, // Log to console
  debug: true   // Include SMTP traffic in logs
});

// Generic send function
const sendEmail = async (to, subject, html, attachments = []) => {
  if (!keys.emailUser || !keys.emailPass) {
    console.log('Email credentials not provided. Skipping email.');
    return false;
  }

  const mailOptions = {
    from: `"LinkAuthority" <${keys.emailUser}>`,
    to,
    subject,
    html,
    attachments
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email to ' + to, error);
    return { success: false, error: error.message };
  }
};

// Templates
const sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to LinkAuthority!';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563EB;">Welcome to LinkAuthority!</h2>
      <p>Hi ${user.name},</p>
      <p>Thanks for joining LinkAuthority! We're excited to help you build high-authority backlinks and boost your SEO rankings.</p>
      <p><strong>Next Steps:</strong></p>
      <ol>
        <li>Add your website to the platform.</li>
        <li>Verify ownership to earn your initial points.</li>
        <li>Start exchanging high-quality backlinks!</li>
      </ol>
      <a href="https://linkauthority.com" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
      <p style="margin-top: 30px; font-size: 12px; color: #666;">If you have any questions, reply to this email.</p>
    </div>
  `;
  await sendEmail(user.email, subject, html);
};

const sendWebsiteAddedEmail = async (user, website) => {
  const subject = 'Website Added Details - LinkAuthority';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563EB;">Website Added Successfully</h2>
      <p>Hi ${user.name},</p>
      <p>You have successfully added <strong>${website.url}</strong> to LinkAuthority.</p>
      <p><strong>Status:</strong> ${website.isVerified ? 'Verified' : 'Unverified'}</p>
      <p><strong>Domain Authority Points:</strong> ${website.domainAuthority}</p>
      ${!website.isVerified ? '<p>Please verify your website to start earning points.</p>' : ''}
    </div>
  `;
  await sendEmail(user.email, subject, html);
};

const sendWebsiteVerifiedEmail = async (user, website) => {
  const subject = 'Website Verified! - LinkAuthority';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10B981;">Website Verified Successfully!</h2>
      <p>Hi ${user.name},</p>
      <p>Great news! Your website <strong>${website.url}</strong> has been verified.</p>
      <p>You can now use this site to exchange links and earn points.</p>
    </div>
  `;
  await sendEmail(user.email, subject, html);
};

const sendLinkRequestEmail = async (seller, buyerName, transaction) => {
  const subject = 'New Backlink Request - LinkAuthority';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563EB;">New Link Opportunity!</h2>
      <p>Hi ${seller.name},</p>
      <p><strong>${buyerName}</strong> wants to place a link on your site.</p>
      <p><strong>Target URL (You host this):</strong> ${transaction.targetUrl}</p>
      <p><strong>Points to Earn:</strong> ${transaction.points}</p>
      <p>Log in to your dashboard to view details and approve the request.</p>
      <a href="https://linkauthority.com" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Request</a>
    </div>
  `;
  await sendEmail(seller.email, subject, html);
};

const sendLinkVerifiedEmail = async (buyer, sellerName, transaction) => {
  const subject = 'Backlink Verified & Live! - LinkAuthority';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10B981;">Backlink Success!</h2>
      <p>Hi ${buyer.name},</p>
      <p>Your backlink on <strong>${sellerName}'s website</strong> has been verified and is live!</p>
      <p><strong>Your Link:</strong> ${transaction.sourceUrl}</p>
      <p><strong>Verified At:</strong> ${transaction.verificationUrl}</p>
      <p>Points have been transferred successfully.</p>
    </div>
  `;
  await sendEmail(buyer.email, subject, html);
};

const sendAdminNotification = async (subject, message) => {
  if (!keys.adminEmail) return;
  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2>Admin Notification</h2>
      <p>${message}</p>
    </div>
  `;
  await sendEmail(keys.adminEmail, `Admin Alert: ${subject}`, html);
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendWebsiteAddedEmail,
  sendWebsiteVerifiedEmail,
  sendLinkRequestEmail,
  sendLinkVerifiedEmail,
  sendAdminNotification
};
