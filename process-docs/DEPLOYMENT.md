# MessageAI Deployment Guide

Complete guide for deploying MessageAI to production across all platforms.

## Quick Deploy Checklist

### Pre-deployment (5 minutes)
- [ ] Update app version in `app.json` and `package.json`
- [ ] Set `USE_EMULATORS = false` in `config/firebase.js`
- [ ] Test on real device with production Firebase
- [ ] Run `npm run lint && npm run test`

### Firebase Setup (10 minutes)
- [ ] Deploy Firestore rules: `firebase deploy --only firestore`
- [ ] Deploy RTDB rules: `firebase deploy --only database`
- [ ] Verify rules in Firebase console
- [ ] Check Firebase usage quotas

### Build & Deploy (15-30 minutes)
- [ ] Run `eas build --platform android --profile preview` (Android APK)
- [ ] Test APK on real Android device
- [ ] Run `eas build --platform ios --profile preview` (iOS TestFlight)
- [ ] Submit to App Store Connect if ready

## Environment Setup

### Development vs Production

```javascript
// config/firebase.js
const USE_EMULATORS = false; // Set to false for production builds

// For development
if (USE_EMULATORS) {
  // Connect to local emulators
}

// For production  
if (!USE_EMULATORS) {
  // Use production Firebase
  enableIndexedDbPersistence(db);
}
```

### Environment Variables

Create `.env.local` from `.env.example`:

```bash
# Copy template
cp .env.example .env.local

# Fill in production values
EXPO_PUBLIC_FIREBASE_PROJECT_ID=msgapp-74ca2
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://msgapp-74ca2-default-rtdb.firebaseio.com
EXPO_PUBLIC_USE_EMULATORS=false
EXPO_PUBLIC_LOG_LEVEL=WARN
```

## Firebase Deployment

### 1. Firestore Rules

Deploy secure rules:

```bash
# Deploy rules
firebase deploy --only firestore

# Verify deployment
firebase firestore:rules:list

# Test rules (optional)
firebase emulators:start --only firestore
```

Current rules provide:
- User authentication required
- Users can only access chats they're members of
- Users can only send messages as themselves
- Read receipts can be updated by chat members

### 2. Realtime Database Rules

Deploy presence rules:

```bash
# Deploy RTDB rules
firebase deploy --only database

# Verify deployment
firebase database:rules:validate database.rules.json
```

Rules provide:
- Users can only write their own presence status
- All authenticated users can read presence
- Automatic offline detection via `.onDisconnect()`

### 3. Storage Rules (if using photos)

```bash
# Deploy storage rules
firebase deploy --only storage
```

### 4. Firebase Indexes

Auto-generated indexes should work, but for optimization:

```bash
# Deploy custom indexes
firebase deploy --only firestore:indexes

# Monitor index build status
firebase firestore:indexes
```

## EAS Build Configuration

### Build Profiles

The app has three build profiles:

```json
{
  "development": {
    "developmentClient": true,
    "distribution": "internal",
    "env": {
      "EXPO_PUBLIC_USE_EMULATORS": "true",
      "EXPO_PUBLIC_LOG_LEVEL": "DEBUG"
    }
  },
  "preview": {
    "distribution": "internal",
    "android": { "buildType": "apk" },
    "env": {
      "EXPO_PUBLIC_USE_EMULATORS": "false",
      "EXPO_PUBLIC_LOG_LEVEL": "INFO"
    }
  },
  "production": {
    "distribution": "store",
    "android": { "buildType": "aab" },
    "env": {
      "EXPO_PUBLIC_USE_EMULATORS": "false",
      "EXPO_PUBLIC_LOG_LEVEL": "WARN"
    }
  }
}
```

### Android Deployment

#### 1. Build APK (Internal Testing)

```bash
cd messageai

# Login to Expo (first time only)
eas login

# Build APK for internal testing
eas build --platform android --profile preview

# Wait for build (10-15 minutes)
# Download APK from build URL
```

#### 2. Build AAB (Play Store)

```bash
# Build App Bundle for Play Store
eas build --platform android --profile production

# Submit to Play Store (optional)
eas submit --platform android --profile production
```

#### 3. Testing Android Builds

```bash
# Install APK on device
adb install messageai.apk

# Check logs
adb logcat | grep MessageAI

# Test core functionality:
# 1. Sign up/login
# 2. Send/receive messages  
# 3. Group chat
# 4. Notifications
# 5. Offline sync
```

### iOS Deployment

#### Prerequisites
- Apple Developer Account ($99/year)
- Certificates and provisioning profiles configured

#### 1. Build for TestFlight

```bash
# Build for TestFlight internal testing
eas build --platform ios --profile preview

# Automatically submit to App Store Connect
eas submit --platform ios --profile preview
```

#### 2. Build for App Store

```bash
# Build for App Store production
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --profile production
```

#### 3. Testing iOS Builds

- **TestFlight**: Internal testing with up to 100 users
- **App Store Connect**: Review process (1-7 days)
- **Device testing**: Install via Xcode or TestFlight

## Web Deployment (Optional)

While primarily a mobile app, web deployment is possible:

### Netlify/Vercel Deployment

```bash
# Build web version
npx expo export --platform web

# Deploy static files to hosting service
# Upload dist/ folder to Netlify/Vercel
```

### Limitations
- No push notifications on web
- Limited native functionality
- Photo uploads may not work properly

## CI/CD Pipeline

### GitHub Actions

The project includes automated CI/CD:

```bash
# On push to main/dev:
# 1. Lint and type check
# 2. Run tests
# 3. Validate Firebase rules
# 4. Build preview (if configured)

# Manual triggers:
# 1. Production builds
# 2. Store submissions
```

### Automated Builds

```bash
# Set up Expo token for CI
# In GitHub repository > Settings > Secrets
# Add EXPO_TOKEN with your Expo access token

# Builds will trigger automatically on push to main
```

## Production Monitoring

### Firebase Console

Monitor app health:
- **Authentication**: User signups/logins
- **Firestore**: Read/write operations, errors
- **Functions**: Execution logs (if using Cloud Functions)
- **Storage**: Upload/download activity

### Expo Dashboard

Track app performance:
- **Analytics**: User engagement, retention
- **Errors**: Crash reports, error logs
- **Updates**: OTA update adoption
- **Builds**: Build history and artifacts

### Crash Reporting

```bash
# Enable Sentry (optional)
expo install sentry-expo

# Configure in App.js
import * as Sentry from 'sentry-expo';

Sentry.init({
  dsn: 'YOUR_DSN_HERE',
});
```

## Security Checklist

### Pre-deployment Security

- [ ] Firebase rules restrict access properly
- [ ] No hardcoded secrets in code
- [ ] Environment variables configured correctly
- [ ] HTTPS enforced for all connections
- [ ] Input validation on all forms

### Post-deployment Security

- [ ] Monitor Firebase security rules
- [ ] Regular security updates
- [ ] User data privacy compliance
- [ ] Rate limiting for API calls
- [ ] Regular backup verification

## Performance Optimization

### Bundle Size

```bash
# Analyze bundle
npx expo export --analyze

# Optimize imports
# Use specific imports instead of entire libraries
import { specific } from 'library/specific';

# Remove unused dependencies
npm audit
```

### Database Optimization

```bash
# Monitor query performance in Firebase console
# Add indexes for slow queries
# Use pagination for large datasets
# Cache frequently accessed data
```

## Rollback Procedures

### EAS Builds

```bash
# If new build has issues:
# 1. Build previous version
eas build --platform all --profile production

# 2. Submit previous version
eas submit --platform all --profile production
```

### Firebase Rules

```bash
# Rollback rules if needed
firebase firestore:rules:release [RELEASE_NAME]
firebase database:rules:release [RELEASE_NAME]
```

### Over-the-Air Updates

```bash
# Push emergency fix without new build (Expo Updates)
expo publish --release-channel production
```

## Launch Checklist

### Pre-launch (1 week before)
- [ ] Complete security audit
- [ ] Performance testing on various devices
- [ ] Backup and disaster recovery plan
- [ ] Customer support documentation
- [ ] Marketing materials prepared

### Launch Day
- [ ] Deploy latest build to stores
- [ ] Monitor crash reports and analytics
- [ ] Respond to user feedback quickly
- [ ] Watch Firebase quotas and costs
- [ ] Social media announcement

### Post-launch (1 week after)
- [ ] Analyze user adoption metrics
- [ ] Address critical bugs quickly
- [ ] Plan first update based on feedback
- [ ] Review and adjust Firebase quotas
- [ ] Collect and prioritize feature requests

## Troubleshooting

### Common Deployment Issues

#### Build Failures
```bash
# Clear cache and rebuild
eas build --clear-cache --platform all --profile preview

# Check logs in Expo dashboard
# Fix any dependency or configuration issues
```

#### Firebase Rules Rejected
```bash
# Test rules locally first
firebase emulators:start --only firestore

# Validate rules syntax
firebase firestore:rules:validate
```

#### Store Rejection
- Follow platform guidelines (iOS Human Interface Guidelines, Material Design)
- Ensure proper permissions declarations
- Test on various screen sizes
- Provide clear app description and screenshots

## Cost Monitoring

### Firebase Costs
- **Firestore**: ~$0.06 per 100K reads, $0.18 per 100K writes
- **Storage**: ~$0.026 per GB per month
- **Functions**: ~$0.0001 per execution
- **Hosting**: ~$0.15 per GB transferred

### Expo Costs
- **EAS Build**: Free tier includes 30 builds/month
- **EAS Submit**: Free
- **Push Notifications**: 1M free per month

### Store Costs
- **Apple App Store**: $99/year developer account
- **Google Play Store**: $25 one-time registration

## Support

### Documentation
- [Expo Documentation](https://docs.expo.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [React Native Documentation](https://reactnative.dev/)

### Community
- [Expo Discord](https://discord.gg/4gtbPAdpaE)
- [Firebase Slack](https://firebase.community/)
- [React Native Community](https://reactnative.dev/community/overview)

### Paid Support
- Expo prioritized support plans available
- Firebase premium support through Google Cloud
- React Native consulting services

---

## Next Steps

1. **Test current deployment** - Follow Android APK build process
2. **Set up monitoring** - Configure Firebase alerts and Expo analytics
3. **Plan updates** - Establish release schedule and update procedures
4. **Scale preparation** - Monitor usage and plan for growth
5. **User feedback** - Set up feedback collection and response process
