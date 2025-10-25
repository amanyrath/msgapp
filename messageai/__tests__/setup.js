/**
 * Jest Setup for MessageAI
 * Configures testing environment with Firebase mocks and React Native Testing Library
 */

import 'react-native-gesture-handler/jestSetup';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import { jest } from '@jest/globals';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock React Native modules
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock Expo modules
jest.mock('expo-constants', () => ({
  appOwnership: 'expo', // Simulate development build
  manifest: {
    extra: {
      OPENAI_API_KEY: 'test-openai-key'
    }
  },
  expoConfig: {
    extra: {
      OPENAI_API_KEY: 'test-openai-key'
    }
  }
}));

jest.mock('expo-localization', () => ({
  getLocalizationAsync: () => Promise.resolve({
    locale: 'en-US',
    locales: ['en-US'],
    timezone: 'America/New_York',
    isoCurrencyCodes: ['USD'],
    region: 'US',
    isRTL: false,
  }),
  getLocales: () => [{ 
    languageCode: 'en', 
    regionCode: 'US',
    languageTag: 'en-US',
    textDirection: 'ltr'
  }]
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'mock-push-token' })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ cancelled: true })),
  launchCameraAsync: jest.fn(() => Promise.resolve({ cancelled: true })),
  MediaTypeOptions: {
    Images: 'Images'
  }
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    pop: jest.fn(),
    setOptions: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
    name: 'TestScreen',
    key: 'test-key'
  }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi'
  })),
  configure: jest.fn(),
}));

// Firebase Mocks
const mockFirebaseAuth = {
  currentUser: null,
  signInWithEmailAndPassword: jest.fn(() => Promise.resolve({
    user: { uid: 'test-user-id', email: 'test@example.com' }
  })),
  createUserWithEmailAndPassword: jest.fn(() => Promise.resolve({
    user: { uid: 'test-user-id', email: 'test@example.com' }
  })),
  signOut: jest.fn(() => Promise.resolve()),
  onAuthStateChanged: jest.fn(),
  updateProfile: jest.fn(() => Promise.resolve()),
};

const mockFirestoreDoc = {
  get: jest.fn(() => Promise.resolve({
    exists: true,
    data: () => ({ id: 'test-doc', name: 'Test Document' }),
    id: 'test-doc'
  })),
  set: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
  delete: jest.fn(() => Promise.resolve()),
  onSnapshot: jest.fn(() => jest.fn()),
};

const mockFirestoreCollection = {
  doc: jest.fn(() => mockFirestoreDoc),
  add: jest.fn(() => Promise.resolve({ id: 'new-doc-id' })),
  where: jest.fn(() => mockFirestoreCollection),
  orderBy: jest.fn(() => mockFirestoreCollection),
  limit: jest.fn(() => mockFirestoreCollection),
  get: jest.fn(() => Promise.resolve({
    docs: [mockFirestoreDoc],
    empty: false,
    size: 1
  })),
  onSnapshot: jest.fn(() => jest.fn()),
};

const mockFirestore = {
  collection: jest.fn(() => mockFirestoreCollection),
  doc: jest.fn(() => mockFirestoreDoc),
  runTransaction: jest.fn((fn) => fn({
    get: mockFirestoreDoc.get,
    set: mockFirestoreDoc.set,
    update: mockFirestoreDoc.update,
  })),
  batch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(() => Promise.resolve())
  })),
  enableOffline: jest.fn(() => Promise.resolve()),
  disableOffline: jest.fn(() => Promise.resolve()),
  FieldValue: {
    serverTimestamp: jest.fn(() => 'server-timestamp'),
    arrayUnion: jest.fn((...args) => ({ arrayUnion: args })),
    arrayRemove: jest.fn((...args) => ({ arrayRemove: args })),
  },
  FieldPath: {
    documentId: jest.fn(() => '__name__'),
  }
};

const mockDatabase = {
  ref: jest.fn(() => ({
    set: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
    remove: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(() => Promise.resolve({
      val: () => ({ status: 'online', lastChanged: Date.now() })
    })),
    onDisconnect: jest.fn(() => ({
      set: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve())
    })),
    child: jest.fn(() => mockDatabase.ref()),
  })),
  goOffline: jest.fn(),
  goOnline: jest.fn(),
  ServerValue: {
    TIMESTAMP: 'server-timestamp'
  }
};

// Mock Firebase modules
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => mockFirebaseAuth),
  connectAuthEmulator: jest.fn(),
  signInWithEmailAndPassword: mockFirebaseAuth.signInWithEmailAndPassword,
  createUserWithEmailAndPassword: mockFirebaseAuth.createUserWithEmailAndPassword,
  signOut: mockFirebaseAuth.signOut,
  onAuthStateChanged: mockFirebaseAuth.onAuthStateChanged,
  updateProfile: mockFirebaseAuth.updateProfile,
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => mockFirestore),
  connectFirestoreEmulator: jest.fn(),
  enableOffline: mockFirestore.enableOffline,
  disableOffline: mockFirestore.disableOffline,
  collection: mockFirestore.collection,
  doc: mockFirestore.doc,
  getDoc: mockFirestoreDoc.get,
  getDocs: mockFirestoreCollection.get,
  setDoc: mockFirestoreDoc.set,
  updateDoc: mockFirestoreDoc.update,
  deleteDoc: mockFirestoreDoc.delete,
  addDoc: mockFirestoreCollection.add,
  query: jest.fn((...args) => args),
  where: jest.fn(() => mockFirestoreCollection),
  orderBy: jest.fn(() => mockFirestoreCollection),
  limit: jest.fn(() => mockFirestoreCollection),
  onSnapshot: mockFirestoreDoc.onSnapshot,
  runTransaction: mockFirestore.runTransaction,
  writeBatch: mockFirestore.batch,
  serverTimestamp: mockFirestore.FieldValue.serverTimestamp,
  arrayUnion: mockFirestore.FieldValue.arrayUnion,
  arrayRemove: mockFirestore.FieldValue.arrayRemove,
  documentId: mockFirestore.FieldPath.documentId,
}));

jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => mockDatabase),
  connectDatabaseEmulator: jest.fn(),
  ref: mockDatabase.ref,
  set: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
  remove: jest.fn(() => Promise.resolve()),
  get: jest.fn(() => Promise.resolve({
    val: () => ({ status: 'online', lastChanged: Date.now() })
  })),
  onValue: jest.fn(),
  off: jest.fn(),
  onDisconnect: jest.fn(() => ({
    set: jest.fn(() => Promise.resolve()),
    remove: jest.fn(() => Promise.resolve())
  })),
  goOffline: mockDatabase.goOffline,
  goOnline: mockDatabase.goOnline,
  serverTimestamp: jest.fn(() => 'server-timestamp'),
}));

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(() => Promise.resolve({
          choices: [{
            message: {
              content: 'Mocked AI response'
            }
          }]
        }))
      }
    }
  }));
});

// Console warnings we want to suppress in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      /Warning.*not wrapped in act/.test(args[0]) ||
      /Warning.*componentWillReceiveProps/.test(args[0]) ||
      /Warning.*componentWillUpdate/.test(args[0])
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Global test timeout
jest.setTimeout(10000);

// Export mocks for use in tests
export {
  mockFirebaseAuth,
  mockFirestore,
  mockDatabase,
  mockFirestoreDoc,
  mockFirestoreCollection
};