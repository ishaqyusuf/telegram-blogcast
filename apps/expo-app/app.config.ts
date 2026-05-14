import { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Al-Ghurobaa",
  slug: "alghurobaa",
  // slug: "prodesk",
  version: "1.0.108",
  orientation: "portrait",
  icon: "./assets/icons/adaptive-icon.png",
  scheme: "alghurobaa",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.alghurobaa.podcast",
    icon: {
      dark: "./assets/icons/ios-dark.png",
      light: "./assets/icons/ios-light.png",
    },
  },

  android: {
    // buildType: "apk",
    // gradleCommand: ":app:assembleRelease",
    adaptiveIcon: {
      // backgroundColor: "#ffffff",
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/icons/adaptive-icon.png",
      backgroundImage: "./assets/icons/adaptive-icon.png",
      monochromeImage: "./assets/icons/adaptive-icon.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    usesCleartextTraffic: true,
    package: "com.alghurobaa.podcast",
  },

  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },

  plugins: [
    "expo-router",
    [
      "@sentry/react-native/expo",
      {
        url: "https://sentry.io/",
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT_MOBILE ?? process.env.SENTRY_PROJECT,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/icons/splash-icon-light.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
          image: "./assets/icons/splash-icon-dark.png",
        },
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  extra: {
    router: {},
    eas: {
      projectId: "9d8a8cd8-d310-4724-8a61-db39e6b56c9a", //ishaqyusuf
    },
  },
  owner: "ishaqyusuf",
  updates: {
    url: "https://u.expo.dev/9d8a8cd8-d310-4724-8a61-db39e6b56c9a", //ishaqyusuf
  },
  runtimeVersion: {
    policy: "appVersion",
  },
};

export default config;
