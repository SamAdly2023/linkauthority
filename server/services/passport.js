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
      console.log("Google Auth Callback Started");
      console.log("Profile ID:", profile.id);
      console.log("Profile Email:", profile.emails && profile.emails[0] ? profile.emails[0].value : "No Email");

      try {
        // 1. Check if user exists with this Google ID
        const existingUser = await User.findOne({ googleId: profile.id });
        if (existingUser) {
          console.log("User found by Google ID:", existingUser.id);
          return done(null, existingUser);
        }

        // 2. Check if user exists with this Email (to prevent duplicate email error)
        if (profile.emails && profile.emails.length > 0) {
            const existingEmailUser = await User.findOne({ email: profile.emails[0].value });
            if (existingEmailUser) {
              console.log("User found by Email. Linking Google ID...");
              // Link the Google ID to this existing user account
              existingEmailUser.googleId = profile.id;
              existingEmailUser.name = existingEmailUser.name || profile.displayName; // Update name if missing
              await existingEmailUser.save();
              console.log("User linked successfully:", existingEmailUser.id);
              return done(null, existingEmailUser);
            }
        }

        // 3. Create new user if neither exists
        console.log("Creating new user...");
        const user = await new User({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails && profile.emails[0] ? profile.emails[0].value : undefined
        }).save();
        console.log("New user created:", user.id);
        done(null, user);
      } catch (err) {
        console.error("CRITICAL ERROR in Google Strategy:", err);
        done(err, null);
      }
    }
  )
);