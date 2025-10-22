/**
 * Test setup configuration
 */

import 'react-native-gesture-handler/jestSetup';

// Mock Firebase
jest.mock('../config/firebase', () => ({
  auth: {
    onAuthStateChanged: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
  },
  db: {
    collection: jest.fn(),
    doc: jest.fn(),
  },
  rtdb: {
    ref: jest.fn(),
    set: jest.fn(),
    onDisconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

// Mock Expo modules
jest.mock('expo-constants', () => ({
  appOwnership: 'expo', // Simulate development build
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  setNotificationHandler: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, type: 'wifi' })),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

// Mock Logger
jest.mock('../utils/logger', () => ({
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    firebase: jest.fn(),
    network: jest.fn(),
    photo: jest.fn(),
    auth: jest.fn(),
    ui: jest.fn(),
    perf: jest.fn(),
  },
  PerfLogger: {
    start: jest.fn(() => ({ end: jest.fn() })),
  },
  devLog: jest.fn(),
  devWarn: jest.fn(),
  devError: jest.fn(),
}));

// Silence console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  log: jest.fn(),
};
