import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectDatabaseEmulator } from 'firebase/database';
import { connectStorageEmulator } from 'firebase/storage';
import { ref, set } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Initialize Firebase Auth with AsyncStorage persistence
let auth;
try {
  // Try to initialize auth with AsyncStorage persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
  console.log('✅ Firebase Auth initialized with AsyncStorage persistence');
} catch (error) {
  // Auth already initialized, use existing instance
  auth = getAuth(app);
  console.log('✅ Using existing Firebase Auth instance');
}

export { auth };
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);

import { Logger } from '../utils/logger';

Logger.firebase('init', 'Firebase services initialized', {
  auth: !!auth,
  authPersistence: 'AsyncStorage',
  firestore: !!db,
  rtdb: !!rtdb,
  storage: !!storage,
  databaseURL: firebaseConfig.databaseURL
});

// Connect to Firebase Emulator (for local development)
// Set to false for production
const USE_EMULATORS = false;

if (USE_EMULATORS) {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    Logger.firebase('emulator', 'Auth emulator connected');
  } catch (e) {
    Logger.firebase('emulator', 'Auth emulator already connected', { error: e.message });
  }

  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    Logger.firebase('emulator', 'Firestore emulator connected');
  } catch (e) {
    Logger.firebase('emulator', 'Firestore emulator already connected', { error: e.message });
  }

  try {
    connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);
    Logger.firebase('emulator', 'RTDB emulator connected', { rtdbInstance: !!rtdb });
  } catch (e) {
    Logger.firebase('emulator', 'RTDB emulator already connected', { error: e.message });
  }

  try {
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    console.log('✅ Storage emulator connected');
  } catch (e) {
    console.log('Storage emulator already connected or error:', e.message);
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
        Logger.warn('Firebase', 'Offline persistence failed: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        Logger.warn('Firebase', 'Offline persistence not supported in this browser');
      } else {
        Logger.error('Firebase', 'Error enabling offline persistence', { error: err });
      }
    });
  }
}

export default app;
