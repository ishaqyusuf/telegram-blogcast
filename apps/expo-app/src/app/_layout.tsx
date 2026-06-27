import { GestureHandlerRootView } from "react-native-gesture-handler";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useThemeConfig } from "@/hooks/use-theme-color";
import { ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import "react-native-reanimated";
import "@/styles/global.css";
import { AuthProvider, useCreateAuthContext } from "@/hooks/use-auth";

import Toast from "react-native-toast-message";
import { ToastProviderWithViewport } from "@/components/ui/toast";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import FlashMessage from "react-native-flash-message";
import { PortalHost } from "@rn-primitives/portal";
import { TRPCReactProvider } from "@/trpc/client";
import { StaticTrpc } from "@/components/static-trpc";
import { AppStatusBar } from "@/components/app-status-bar";
import { Linking, Platform, View } from "react-native";
import { StaticRouter } from "@/components/static-router";
import { GlobalAudioBar } from "@/components/global-audio-bar";
import { ChannelUpdatePrompt } from "@/components/channel-updates/channel-update-prompt";
import { AppAutoUpdateModal } from "@/components/app-auto-update-modal";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useColorScheme, useColors } from "@/hooks/use-color";
import { initSentry, Sentry } from "@/lib/sentry";
import { getThemeOverride } from "@/lib/theme-preference";
import { initLocalDb } from "@/db/local-db";
import { useAudioStore } from "@/store/audio-store";
import { useTranscriptionQueue } from "@/hooks/use-transcription-queue";
export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  initialRouteName: "index",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
initSentry();

const TRACK_PLAYER_NOTIFICATION_URL = "trackplayer://notification.click";

function AudioBootstrap() {
  const restoreAudio = useAudioStore((s) => s.restoreAudio);

  useEffect(() => {
    restoreAudio().catch((error) => {
      console.warn("[audio] restore failed", error);
    });
  }, [restoreAudio]);

  return null;
}

function AudioNotificationRouter() {
  const blogId = useAudioStore((s) => s.blog?.id);
  const handledInitialUrlRef = useRef(false);
  const pendingNotificationOpenRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "android" || !blogId) return;
    if (!pendingNotificationOpenRef.current) return;

    pendingNotificationOpenRef.current = false;
    router.push(`/blog-view-2/${blogId}?openComments=1` as any);
  }, [blogId]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const openCurrentAudioComments = (url: string | null | undefined) => {
      if (!url?.startsWith(TRACK_PLAYER_NOTIFICATION_URL)) return;

      if (!blogId) {
        pendingNotificationOpenRef.current = true;
        return;
      }

      router.push(`/blog-view-2/${blogId}?openComments=1` as any);
    };

    if (!handledInitialUrlRef.current) {
      handledInitialUrlRef.current = true;
      Linking.getInitialURL()
        .then(openCurrentAudioComments)
        .catch((error) => {
          console.warn("[audio] notification link failed", error);
        });
    }

    const subscription = Linking.addEventListener("url", ({ url }) => {
      openCurrentAudioComments(url);
    });

    return () => {
      subscription.remove();
    };
  }, [blogId]);

  return null;
}

function TranscriptionQueueObserver() {
  useTranscriptionQueue();
  return null;
}

function RootLayout() {
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
    }
  }, [loaded]);

  useEffect(() => {
    initLocalDb().catch((error) => {
      console.warn("[DB] local init failed", error);
    });
  }, []);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}
const InitialLayout = () => {
  const colors = useColors();

  return (
    <>
      <TRPCReactProvider>
        <StaticTrpc />
        <StaticRouter />
        <AudioBootstrap />
        <AudioNotificationRouter />
        <ChannelUpdatePrompt />
        <TranscriptionQueueObserver />
        <AppAutoUpdateModal />
        <AppStatusBar />
        {/* <StatusBar style="auto" /> */}

        <Stack
          initialRouteName="index"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="home" />
          <Stack.Screen name="blog-view-2/[blogId]/index" />
          <Stack.Screen
            name="blog-view-2/[blogId]/transcribe-audio"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen name="blog-search" />
          <Stack.Screen name="blog-view/[blogId]/index" />
          <Stack.Screen name="blog-view-text/[blogId]/index" />
          <Stack.Screen name="blog-form" options={{ presentation: "modal" }} />
          <Stack.Screen name="blog-import" />
          <Stack.Screen name="channels" />
          <Stack.Screen name="channels/[channelId]" />
          <Stack.Screen name="channel-updates" />
          <Stack.Screen name="play-history" />
          <Stack.Screen name="search" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="transcribe-queue" />
          <Stack.Screen name="updates" />
          <Stack.Screen name="albums" />
          <Stack.Screen name="albums/[albumId]" />
          <Stack.Screen name="playlists" />
          <Stack.Screen name="playlists/[playlistId]" />
          <Stack.Screen name="book-fetch" />
          <Stack.Screen
            name="book-fetch-browser"
            options={{ presentation: "fullScreenModal" }}
          />
          <Stack.Screen name="book-fetch-preview" />
          <Stack.Screen name="books" />
          <Stack.Screen name="books/[bookId]" />
          <Stack.Screen name="books/[bookId]/reader/[pageId]" />
          <Stack.Screen name="books/[bookId]/search" />
          <Stack.Screen
            name="blog-options/[blogId]/index"
            options={{
              presentation: "transparentModal",
              animation: "fade",
              headerShown: false,
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
        <PortalHost />
      </TRPCReactProvider>
    </>
  );
};
function RootLayoutNav() {
  const { setColorScheme } = useColorScheme();
  const theme = useThemeConfig();
  const colors = useColors();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const override = await getThemeOverride();
      if (!mounted) return;
      setColorScheme(override);
    })();
    return () => {
      mounted = false;
    };
  }, [setColorScheme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <View
          className="flex-1 bg-background"
          style={{ backgroundColor: colors.background }}
        >
          <ThemeProvider value={theme}>
            <AuthProvider value={useCreateAuthContext()}>
              <ToastProviderWithViewport>
                <BottomSheetModalProvider>
                  <FlashMessage position="top" />
                  <InitialLayout />
                </BottomSheetModalProvider>
              </ToastProviderWithViewport>
            </AuthProvider>
          </ThemeProvider>
        </View>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
