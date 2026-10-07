import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { getWebUrl } from "./base-url";

export const authClient = createAuthClient({
  baseURL: getWebUrl(),

  plugins: [
    expoClient({
      scheme: "alghurobaa",
      storagePrefix: "alghurobaa",
      storage: SecureStore,
    }),
  ],
});
