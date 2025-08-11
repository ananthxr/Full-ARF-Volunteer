// Firebase configuration and initialization for AR Treasure Hunt Volunteer Page

import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBzmrWMFPewbekaxThp_I1UZ1Up3s8XbXA",
  authDomain: "arth2-169a4.firebaseapp.com",
  projectId: "arth2-169a4",
  databaseURL: "https://arth2-169a4-default-rtdb.firebaseio.com/",
  storageBucket: "arth2-169a4.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Realtime Database
export const db = getDatabase(app);

// Auto sign-in anonymously when Firebase initializes
if (typeof window !== 'undefined') {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      signInAnonymously(auth).catch((error) => {
        console.error('Anonymous auth failed:', error);
      });
    }
  });
}

export default app;