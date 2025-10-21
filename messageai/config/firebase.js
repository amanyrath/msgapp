import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

// Firebase configuration from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyDgYZ0XaiS2q9UrFr1JVV3JHunM3stqAS4",
  authDomain: "msgapp-74ca2.firebaseapp.com",
  projectId: "msgapp-74ca2",
  storageBucket: "msgapp-74ca2.firebasestorage.app",
  messagingSenderId: "978847373297",
  appId: "1:978847373297:web:dd410f81784dfda4d09650",
  measurementId: "G-1HL5WZWVKH",
  databaseURL: "https://msgapp-74ca2-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time.
    console.warn('Offline persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // The current browser doesn't support persistence
    console.warn('Offline persistence not supported in this browser');
  } else {
    console.error('Error enabling offline persistence:', err);
  }
});

// Connect to Firebase Emulator (for local development)
// Uncomment these lines if using Firebase Emulator:
/*
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';

connectAuthEmulator(auth, 'http://127.0.0.1:9099');
connectFirestoreEmulator(db, '127.0.0.1', 8080);
console.log('Connected to Firebase Emulator');
*/

export default app;

