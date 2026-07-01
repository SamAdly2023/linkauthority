const admin = require('firebase-admin');

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env variable:", err);
  }
}

if (!serviceAccount) {
  try {
    serviceAccount = require('../config/firebase-service-account.json');
  } catch (err) {
    console.error("Failed to load firebase-service-account.json file:", err);
  }
}

if (serviceAccount) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} else {
  console.error("CRITICAL: Firebase Admin credentials not found! Both environment variable and JSON file are missing.");
}

const auth = admin.auth();
const db = admin.firestore();

// Helpers for Firestore conversions / schema mapping if helpful
const toDoc = (doc) => {
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
};

const toDocs = (snapshot) => {
  const docs = [];
  snapshot.forEach(doc => {
    docs.push({ id: doc.id, ...doc.data() });
  });
  return docs;
};

module.exports = {
  admin,
  auth,
  db,
  toDoc,
  toDocs
};
