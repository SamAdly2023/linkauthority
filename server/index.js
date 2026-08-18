const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const firebaseAuth = require('./middlewares/firebaseAuth');

const app = express();

// Force www redirect in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.headers.host.startsWith('www.')) {
    return res.redirect(301, 'https://www.linkauthority.live' + req.url);
  }
  next();
});

app.set('trust proxy', 1); // Trust first proxy for Render

// Security Headers
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "'unsafe-eval'", 
        "https://accounts.google.com",
        "https://cdn.tailwindcss.com",
        "https://www.paypal.com",
        "https://www.googletagmanager.com",
        "https://*.clarity.ms",
        "https://www.clarity.ms",
        "https://c.bing.com",
        "https://connect.facebook.net",
        "https://www.facebook.com",
        "https://api.xolby.com",
        "https://apis.google.com"
      ],
      connectSrc: [
        "'self'", 
        "https://accounts.google.com", 
        "https://*.googleapis.com",
        "https://www.paypal.com",
        "https://www.google-analytics.com",
        "https://*.clarity.ms",
        "https://c.bing.com",
        "https://*.google.com",
        "https://www.facebook.com",
        "https://web.facebook.com",
        "https://api.xolby.com",
        "https://*.firebaseio.com",
        "wss://*.firebaseio.com"
      ],
      imgSrc: [
        "'self'", 
        "data:", 
        "https://*.googleusercontent.com", 
        "https://*.gravatar.com",
        "https://www.paypalobjects.com",
        "https://www.google.com",
        "https://*.clarity.ms",
        "https://c.bing.com",
        "https://www.facebook.com",
        "https://*.facebook.com",
        "https://ui-avatars.com"
      ],
      frameSrc: [
        "'self'", 
        "https://accounts.google.com",
        "https://www.paypal.com",
        "https://www.sandbox.paypal.com",
        "https://www.facebook.com",
        "https://web.facebook.com",
        "https://api.xolby.com",
        "https://*.firebaseapp.com"
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ]
    },
  },
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, 
  legacyHeaders: false, 
  message: "Too many requests from this IP, please try again after 15 minutes"
});
app.use('/api', limiter); // Apply to API routes

app.use(express.json({ limit: '10kb' })); // Body limit is 10kb
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // wp_remote_post sends form-urlencoded bodies
app.use(cors()); // Note: In production, you might want to restrict this to specific origins

// Data Sanitization against XSS
app.use(xss());

// Prevent Parameter Pollution
app.use(hpp());

// Global Firebase Authentication Middleware
app.use(firebaseAuth);

require('./routes/authRoutes')(app);
require('./routes/apiRoutes')(app);
require('./routes/adminRoutes')(app);
require('./routes/integrationRoutes')(app);

// Global Error Handler to debug 500 errors
app.use((err, req, res, next) => {
  console.error("Global Error Handler Caught:", err);
  res.status(500).json({ 
    error: "Internal Server Error", 
    message: err.message, 
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack 
  });
});

if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  const fs = require('fs');
  const { injectMeta } = require('./services/seo');

  const distDir = path.resolve(__dirname, '../dist');
  // index: false is load-bearing. By default express.static answers "/" with
  // dist/index.html straight off disk, so the home page - the one page carrying
  // the FAQ markup and the main keywords - never reached the metadata injector
  // below while every other route did.
  app.use(express.static(distDir, { index: false }));

  // The SPA shell is read once and kept in memory; only the per-route metadata
  // changes per request.
  let shell = null;
  const readShell = () => {
    if (null === shell) {
      shell = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    }
    return shell;
  };

  app.get('*', (req, res) => {
    try {
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.send(injectMeta(readShell(), req.path));
    } catch (err) {
      console.error('SEO shell injection failed, serving raw index.html:', err.message);
      res.sendFile(path.join(distDir, 'index.html'));
    }
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Start verification Cron Job
    try {
      const cron = require('./services/cron');
      cron.startCron();
      console.log('Daily verification cron job service started.');
    } catch (err) {
      console.error('Failed to start verification cron job service:', err);
    }
});