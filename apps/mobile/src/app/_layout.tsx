import { useThemeConfig } from "@/hooks/use-theme-color";
import { TRPCReactProvider } from "@/trpc/client";
import "@root/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import { ThemeProvider } from "@react-navigation/native";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import FlashMessage from "react-native-flash-message";
import { StaticTrpc } from "@/components/static-trpc";

// import { authClient } from "@/lib/auth-client";
const InitialLayout = () => {
  return (
    <>
      <TRPCReactProvider>
        <StaticTrpc />
        <StatusBar style="auto" />
        <Stack>
          <Stack.Screen name="home" options={{ headerShown: false }} />
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <Toast />
      </TRPCReactProvider>
    </>
  );
};

export const RootLayout = () => {
  const theme = useThemeConfig();
  return (
    <GestureHandlerRootView
      className={theme.dark ? `dark dark-theme` : "light light-theme"}
      style={{ flex: 1 }}
    >
      {/* <Text>Theme: {theme.dark ? "Dark" : "Light"}</Text> */}
      <ThemeProvider value={theme}>
        <BottomSheetModalProvider>
          <FlashMessage position="top" />
          <InitialLayout />
        </BottomSheetModalProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;
