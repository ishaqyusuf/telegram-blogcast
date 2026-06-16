import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import NotFound from "@/screens/not-found";

export default function NotFoundScreen() {
  useEffect(() => {
    if (Platform.OS !== "web") {
      router.replace("/home");
    }
  }, []);

  if (Platform.OS !== "web") return null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NotFound />
    </>
  );
}
