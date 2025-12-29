const express = require('express');
const mongoose = require('mongoose');
const cookieSession = require('cookie-session');
const passport = require('passport');
const cors = require('cors');
require('dotenv').config();

require('./models/User');
require('./models/Website');
require('./models/Transaction');
require('./services/passport');

const keys = require('./config/keys');

if (!keys.googleClientID || !keys.googleClientSecret) {
  console.error("MISSING GOOGLE AUTH KEYS! Authentication will fail.");
}

mongoose.connect(keys.mongoURI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

const app = express();

app.set('trust proxy', 1); // Trust first proxy for Render

app.use(express.json()); // Enable JSON body parsing
app.use(cors());
app.use(
  cookieSession({
    maxAge: 30 * 24 * 60 * 60 * 1000,
    keys: [keys.cookieKey]
  })
);
app.use(passport.initialize());
app.use(passport.session());

require('./routes/authRoutes')(app);
require('./routes/apiRoutes')(app);

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
  app.use(express.static(path.resolve(__dirname, '../dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});