import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectDatabaseEmulator } from 'firebase/database';
import { ref, set } from 'firebase/database';

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

// Initialize Firebase (check if already initialized to avoid duplicate app error)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

console.log('✅ Firebase initialized:', {
  auth: !!auth,
  firestore: !!db,
  rtdb: !!rtdb,
  databaseURL: firebaseConfig.databaseURL
});

// Connect to Firebase Emulator (for local development)
// Set to false for production
const USE_EMULATORS = true;

if (USE_EMULATORS) {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    console.log('✅ Auth emulator connected');
  } catch (e) {
    console.log('Auth emulator already connected or error:', e.message);
  }

  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    console.log('✅ Firestore emulator connected');
  } catch (e) {
    console.log('Firestore emulator already connected or error:', e.message);
  }

  try {
    connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);
    console.log('✅ RTDB emulator connected:', !!rtdb);
  } catch (e) {
    console.log('RTDB emulator already connected or error:', e.message);
  }

  console.log('✅ All Firebase Emulators connected');

  // Test RTDB connection
  setTimeout(() => {
    const testRef = ref(rtdb, 'test/connection');
    set(testRef, { timestamp: Date.now(), message: 'RTDB is working!' })
      .then(() => console.log('✅✅✅ RTDB TEST WRITE SUCCESSFUL!'))
      .catch((err) => console.error('❌ RTDB TEST WRITE FAILED:', err));
  }, 1000);
} else {
  // Enable offline persistence (only for production, not emulators)
  if (getApps().length === 1) {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Offline persistence failed: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('Offline persistence not supported in this browser');
      } else {
        console.error('Error enabling offline persistence:', err);
      }
    });
  }
}

export default app;
