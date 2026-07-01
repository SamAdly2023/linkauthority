module.exports = app => {
  // `/api/current_user` is populated by the firebaseAuth middleware
  app.get('/api/current_user', async (req, res) => {
    if (req.user) {
      req.user.lastActiveAt = new Date();
      await req.user.save();
      await req.user.populate('websites');
    }
    res.send(req.user);
  });

  app.get('/api/logout', (req, res) => {
    res.send({ success: true });
  });
};