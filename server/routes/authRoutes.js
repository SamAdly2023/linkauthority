const passport = require('passport');

module.exports = app => {
  app.get(
    '/auth/google',
    passport.authenticate('google', {
      scope: ['profile', 'email']
    })
  );

  app.get(
    '/auth/google/callback',
    passport.authenticate('google'),
    (req, res) => {
      res.redirect('/');
    }
  );

  app.get('/api/current_user', async (req, res) => {
    if (req.user) {
      // Update last active timestamp
      req.user.lastActiveAt = new Date();
      await req.user.save();

      // Populate websites to send full objects, not just IDs
      await req.user.populate('websites');
    }
    res.send(req.user);
  });

  app.get('/api/logout', (req, res, next) => {
    req.logout((err) => {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });
};