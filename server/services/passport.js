const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const keys = require('../config/keys');

const User = mongoose.model('User');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id).then(user => {
    done(null, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: keys.googleClientID,
      clientSecret: keys.googleClientSecret,
      callbackURL: '/auth/google/callback',
      proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 1. Check if user exists with this Google ID
        const existingUser = await User.findOne({ googleId: profile.id });
        if (existingUser) {
          return done(null, existingUser);
        }

        // 2. Check if user exists with this Email (to prevent duplicate email error)
        const existingEmailUser = await User.findOne({ email: profile.emails[0].value });
        if (existingEmailUser) {
          // Link the Google ID to this existing user account
          existingEmailUser.googleId = profile.id;
          existingEmailUser.name = existingEmailUser.name || profile.displayName; // Update name if missing
          await existingEmailUser.save();
          return done(null, existingEmailUser);
        }

        // 3. Create new user if neither exists
        const user = await new User({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value
        }).save();
        done(null, user);
      } catch (err) {
        console.error("Error in Google Strategy:", err);
        done(err, null);
      }
    }
  )
);