import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAWAN7P0Yq8YRFqoXeJZYrVquEAXJlC2pE",
  authDomain: "link-authority.firebaseapp.com",
  projectId: "link-authority",
  storageBucket: "link-authority.firebasestorage.app",
  messagingSenderId: "667103694709",
  appId: "1:667103694709:web:be3f0c5b6ce79c2031cd3c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
      console.error("Firebase Login Error:", error);
    }
    throw error;
  }
};

export const logoutUser = () => signOut(auth);

export const getIdToken = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(true);
};
