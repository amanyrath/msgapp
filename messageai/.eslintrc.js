module.exports = {
  extends: [
    'expo',
    'eslint:recommended'
  ],
  env: {
    node: true,
    jest: true,
  },
  rules: {
    // Disable console warnings in development
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    
    // React Native specific rules
    'react-native/no-unused-styles': 'warn',
    'react-native/split-platform-components': 'warn',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-color-literals': 'warn',
    
    // General best practices
    'prefer-const': 'warn',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-undef': 'error',
    
    // Import/Export rules
    'import/no-unresolved': 'off', // React Native has its own module resolution
    'import/extensions': 'off',
    
    // Async/Promise rules
    'no-async-promise-executor': 'warn',
    'prefer-promise-reject-errors': 'warn',
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2021,
    sourceType: 'module',
    requireConfigFile: false,
    babelOptions: {
      presets: ['@babel/preset-react'],
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
