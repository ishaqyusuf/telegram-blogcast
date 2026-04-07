import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useThemeConfig } from "@/hooks/use-theme-color";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { initLocalDb } from "@/db/local-db";
import "react-native-reanimated";
import "@/styles/global.css";
import { useColorScheme } from "@/example/components/useColorScheme";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  AuthProvider,
  useAuthContext,
  useCreateAuthContext,
} from "@/hooks/use-auth";

import Toast from "react-native-toast-message";
import { ToastProviderWithViewport } from "@/components/ui/toast";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import FlashMessage from "react-native-flash-message";
import { TRPCReactProvider } from "@/trpc/client";
import { StaticTrpc } from "@/components/static-trpc";
import { AppStatusBar } from "@/components/app-status-bar";
import { View } from "react-native";
import { StaticRouter } from "@/components/static-router";
import { GlobalAudioBar } from "@/components/global-audio-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      // Initialise local SQLite DB (creates tables if they don't exist)
      initLocalDb().catch((e) => console.warn("[DB] initLocalDb error", e));
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}
const InitialLayout = () => {
  const { token, isInstaller, isAdmin, profile } = useAuthContext();
  // console.log({ isInstaller, isAdmin, can: profile?.can });

  return (
    <>
      <TRPCReactProvider>
        <StaticTrpc />
        <StaticRouter />
        <AppStatusBar />
        {/* <StatusBar style="auto" /> */}

        <Stack initialRouteName="home" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="home" />
          <Stack.Screen name="home2" />
          <Stack.Screen name="blog-view-2/[blogId]/index" />
          <Stack.Screen
            name="blog-view-2/[blogId]/transcribe-audio"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen name="blog-search" />
          <Stack.Screen name="blog-view/[blogId]/index" />
          <Stack.Screen name="blog-view-text/[blogId]/index" />
          <Stack.Screen
            name="blog-form"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen name="channels" />
          <Stack.Screen name="channels/[channelId]" />
          <Stack.Screen name="play-history" />
          <Stack.Screen name="search" />
          <Stack.Screen name="albums" />
          <Stack.Screen name="albums/[albumId]" />
          <Stack.Screen name="book-fetch" />
          <Stack.Screen name="books" />
          <Stack.Screen name="books/[bookId]" />
          <Stack.Screen name="books/[bookId]/reader/[pageId]" />
          <Stack.Screen name="books/[bookId]/search" />
          <Stack.Screen
            name="blog-options/[blogId]/index"
            options={{
              presentation: "formSheet",
              sheetGrabberVisible: true,
              sheetAllowedDetents: [0.4, 0.7],
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
          <Stack.Screen
            name="blog-image-view"
            options={{
              presentation: "fullScreenModal",
              animation: "fade",
            }}
          />
          <Stack.Screen name="index" />
          <Stack.Screen name="+not-found" />
        </Stack>
        {/* <Stack>
          <Stack.Protected guard={!token}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={isInstaller}>
            <Stack.Screen
              name="(installers)"
              options={{ headerShown: false }}
            />
          </Stack.Protected>
          <Stack.Protected guard={!!isAdmin}>
            <Stack.Screen name="(job-admin)" options={{ headerShown: false }} />
            <Stack.Screen
              name="(job-admin)/job-overview/[jobId]"
              options={{ headerShown: false }}
            />
          </Stack.Protected>
          <Stack.Protected guard={!isAdmin && !isInstaller}>
            <Stack.Screen name="unavailable" options={{ headerShown: false }} />
          </Stack.Protected>

          <Stack.Screen name="+not-found" />
        </Stack> */}
        <GlobalAudioBar />
        <Toast />
      </TRPCReactProvider>
    </>
  );
};
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const theme = useThemeConfig();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* 
        using  <View className={cn(theme.dark ? "dark" : "", "flex-1")}></View> somehow freezes scroll. the issue is mainly the dark className.
      */}
      <KeyboardProvider>
        <View className="flex-1">
          <ThemeProvider
            value={theme}
          >
            <AuthProvider value={useCreateAuthContext()}>
              <ToastProviderWithViewport>
                <BottomSheetModalProvider>
                  <FlashMessage position="top" />
                  <InitialLayout />
                </BottomSheetModalProvider>
              </ToastProviderWithViewport>
            </AuthProvider>
          </ThemeProvider>
          {/* </View> */}
        </View>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
