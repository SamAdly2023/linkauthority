const fs = require('fs');
const path = require('path');
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
