import 'dotenv/config';

export default {
  expo: {
    name: "messageai",
    slug: "messageai",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.amanyrath.messageai",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "This app uses the camera to take photos for sharing in messages.",
        NSPhotoLibraryUsageDescription: "This app accesses your photo library to select photos for sharing in messages."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      package: "com.amanyrath.messageai",
      permissions: [
        "RECEIVE_BOOT_COMPLETED",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    notification: {
      icon: "./assets/icon.png",
      color: "#007AFF",
      androidMode: "default",
      androidCollapsedTitle: "New messages"
    },
    plugins: [
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#007AFF",
          sounds: ["default"],
          mode: "production"
        }
      ]
    ],
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      eas: {
        projectId: "9a4e5f8e-5788-49cf-babe-ff1d1bf98ae6"
      },
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    },
    runtimeVersion: "1.0.0",
    updates: {
      url: "https://u.expo.dev/9a4e5f8e-5788-49cf-babe-ff1d1bf98ae6"
    }
  }
};
