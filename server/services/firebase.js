const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env variable:", err);
  }
}

if (!serviceAccount) {
  const filePath = path.join(__dirname, '../config/firebase-service-account.json');
  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      serviceAccount = JSON.parse(fileContent);
    } catch (err) {
      console.error("Failed to parse firebase-service-account.json file:", err);
    }
  } else {
    console.log("firebase-service-account.json file does not exist.");
  }
}

let firebaseApp;

if (serviceAccount) {
  const apps = getApps();
  if (apps.length === 0) {
    try {
      firebaseApp = initializeApp({
        credential: cert(serviceAccount)
      });
    } catch (err) {
      console.error("Firebase Admin initialization failed:", err);
    }
  } else {
    firebaseApp = apps[0];
  }
} else {
  console.error("CRITICAL: Firebase Admin credentials not found! Both environment variable and JSON file are missing.");
}

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

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
  admin: { auth, firestore: db }, // for backwards compatibility helper exports if any
  auth,
  db,
  toDoc,
  toDocs
};
