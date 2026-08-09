const { auth, db } = require('../services/firebase');

module.exports = async (req, res, next) => {
  req.user = null;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const userDocRef = db.collection('users').doc(uid);
    let userSnapshot = await userDocRef.get();

    if (!userSnapshot.exists) {
      // Create new user in Firestore
      const newUser = {
        googleId: uid,
        name: decodedToken.name || 'User',
        email: decodedToken.email || '',
        avatar: decodedToken.picture || '',
        points: 200,
        lastActiveAt: new Date(),
        createdAt: new Date(),
        rating: 5.0,
        reviewCount: 0,
        transactions: []
      };
      await userDocRef.set(newUser);
      userSnapshot = await userDocRef.get();
    }

    const userData = userSnapshot.data();

    // Fetch user's websites to pre-populate or make available
    const webSnap = await db.collection('websites').where('ownerId', '==', uid).get();
    const websites = webSnap.docs.map(doc => ({ _id: doc.id, id: doc.id, ...doc.data() }));

    // Construct Mongoose-compatible user object
    req.user = {
      _id: uid,
      id: uid,
      ...userData,
      websites,
      save: async function() {
        const dataToSave = { ...this };
        delete dataToSave.save;
        delete dataToSave.populate;
        delete dataToSave.websites;
        delete dataToSave.id;
        delete dataToSave._id;
        
        // Convert any date fields if needed, Firestore handles JS Date objects perfectly
        await db.collection('users').doc(uid).set(dataToSave, { merge: true });
      },
      populate: async function(field) {
        if (field === 'websites') {
          const wSnap = await db.collection('websites').where('ownerId', '==', uid).get();
          this.websites = wSnap.docs.map(doc => ({ _id: doc.id, id: doc.id, ...doc.data() }));
        }
        return this;
      }
    };

    next();
  } catch (err) {
    console.error("Firebase auth middleware error:", err);
    // Invalid or expired token: don't fail yet, let requireLogin middleware handle 401 if route is protected
    next();
  }
};
