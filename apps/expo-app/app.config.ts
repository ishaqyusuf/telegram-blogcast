import type { ExpoConfig } from "expo/config";

export const UPDATE_VERSION = "2026.07.02.04";

const appVariant =
	process.env.APP_VARIANT ??
	process.env.EXPO_PUBLIC_APP_VARIANT ??
	(process.env.EAS_BUILD_PROFILE === "development" ? "development" : undefined);

const normalizedAppVariant = (appVariant ?? "production").toLowerCase();
const isDevelopmentBuild =
	normalizedAppVariant === "development" || normalizedAppVariant === "dev";
const isPreviewBuild = normalizedAppVariant === "preview";

const variantConfig = isDevelopmentBuild
	? {
			name: "Al-Ghurobaa Dev",
			scheme: "alghurobaa-dev",
			iosBundleIdentifier: "com.alghurobaa.podcast.dev",
			androidPackage: "com.alghurobaa.podcast.dev",
			iconBackgroundColor: "#DFF7EC",
			splashBackgroundColor: "#F4FFF8",
			splashDarkBackgroundColor: "#042116",
			icons: {
				app: "./assets/icons/dev-loading-icon.png",
				adaptive: "./assets/icons/dev-adaptive-icon.png",
				iosDark: "./assets/icons/dev-ios-dark.png",
				iosLight: "./assets/icons/dev-ios-light.png",
				splashLight: "./assets/icons/dev-splash-logo-light.png",
				splashDark: "./assets/icons/dev-splash-logo-dark.png",
			},
		}
	: isPreviewBuild
		? {
				name: "Al-Ghurobaa Preview",
				scheme: "alghurobaa-preview",
				iosBundleIdentifier: "com.alghurobaa.podcast.preview",
				androidPackage: "com.alghurobaa.podcast.preview",
				iconBackgroundColor: "#E6F4FE",
				splashBackgroundColor: "#ffffff",
				splashDarkBackgroundColor: "#000000",
				icons: {
					app: "./assets/icons/loading-icon.png",
					adaptive: "./assets/icons/adaptive-icon.png",
					iosDark: "./assets/icons/ios-dark.png",
					iosLight: "./assets/icons/ios-light.png",
					splashLight: "./assets/icons/splash-logo-light.png",
					splashDark: "./assets/icons/splash-logo-dark.png",
				},
			}
		: {
				name: "Al-Ghurobaa",
				scheme: "alghurobaa",
				iosBundleIdentifier: "com.alghurobaa.podcast",
				androidPackage: "com.alghurobaa.podcast",
				iconBackgroundColor: "#E6F4FE",
				splashBackgroundColor: "#ffffff",
				splashDarkBackgroundColor: "#000000",
				icons: {
					app: "./assets/icons/loading-icon.png",
					adaptive: "./assets/icons/adaptive-icon.png",
					iosDark: "./assets/icons/ios-dark.png",
					iosLight: "./assets/icons/ios-light.png",
					splashLight: "./assets/icons/splash-logo-light.png",
					splashDark: "./assets/icons/splash-logo-dark.png",
				},
			};

const config: ExpoConfig = {
	name: variantConfig.name,
	slug: "alghurobaa",
	// slug: "prodesk",
	version: "1.0.108",
	orientation: "portrait",
	icon: variantConfig.icons.app,
	scheme: variantConfig.scheme,
	userInterfaceStyle: "automatic",
	newArchEnabled: true,
	ios: {
		supportsTablet: true,
		bundleIdentifier: variantConfig.iosBundleIdentifier,
		associatedDomains: ["applinks:alghurobaa.com"],
		icon: {
			dark: variantConfig.icons.iosDark,
			light: variantConfig.icons.iosLight,
		},
	},

	android: {
		// buildType: "apk",
		// gradleCommand: ":app:assembleRelease",
		adaptiveIcon: {
			backgroundColor: variantConfig.iconBackgroundColor,
			foregroundImage: variantConfig.icons.adaptive,
		},
		edgeToEdgeEnabled: true,
		predictiveBackGestureEnabled: false,
		usesCleartextTraffic: true,
		permissions: [
			"android.permission.FOREGROUND_SERVICE",
			"android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
			"android.permission.POST_NOTIFICATIONS",
		],
		package: variantConfig.androidPackage,
		intentFilters: [
			{
				action: "VIEW",
				autoVerify: true,
				data: [
					{
						scheme: "https",
						host: "alghurobaa.com",
						pathPrefix: "/blog",
					},
					{
						scheme: "https",
						host: "alghurobaa.com",
						pathPrefix: "/albums",
					},
				],
				category: ["BROWSABLE", "DEFAULT"],
			},
		],
	},

	web: {
		output: "static",
		favicon: "./assets/images/favicon.png",
	},

	plugins: [
		"./plugins/with-image-clipboard",
		"expo-router",
		[
			"@sentry/react-native/expo",
			{
				url: "https://sentry.io/",
				organization: process.env.SENTRY_ORG,
				project:
					process.env.SENTRY_PROJECT_MOBILE ?? process.env.SENTRY_PROJECT,
			},
		],
		[
			"expo-splash-screen",
			{
				image: variantConfig.icons.splashLight,
				imageWidth: 200,
				resizeMode: "contain",
				backgroundColor: variantConfig.splashBackgroundColor,
				dark: {
					backgroundColor: variantConfig.splashDarkBackgroundColor,
					image: variantConfig.icons.splashDark,
				},
			},
		],
	],

	experiments: {
		typedRoutes: true,
		reactCompiler: true,
	},

	extra: {
		appVariant: normalizedAppVariant,
		updateVersion: UPDATE_VERSION,
		router: {},
		eas: {
			projectId: "9d8a8cd8-d310-4724-8a61-db39e6b56c9a", //ishaqyusuf
		},
	},
	owner: "ishaqyusuf",
	updates: {
		url: "https://u.expo.dev/9d8a8cd8-d310-4724-8a61-db39e6b56c9a", //ishaqyusuf
		checkAutomatically: "NEVER",
	},
	runtimeVersion: {
		policy: "appVersion",
	},
};

export default config;
