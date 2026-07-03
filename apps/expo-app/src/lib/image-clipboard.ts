import * as FileSystem from "expo-file-system/legacy";
import { NativeModules } from "react-native";

type ImageClipboardNativeModule = {
  copyImage: (fileUri: string) => Promise<boolean>;
};

const ImageClipboard =
  NativeModules.ImageClipboard as ImageClipboardNativeModule | undefined;

function getImageExtension(uri: string) {
  const dataMatch = uri.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,/);
  if (dataMatch?.[1]) {
    return dataMatch[1].replace("jpeg", "jpg").replace(/[^a-zA-Z0-9]/g, "");
  }

  const cleanUri = uri.split("?")[0]?.split("#")[0] ?? "";
  const match = cleanUri.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match?.[1]?.toLowerCase() ?? "jpg";
}

async function getLocalImageUri(uri: string) {
  if (uri.startsWith("file://")) return uri;

  const extension = getImageExtension(uri);
  const targetUri = `${FileSystem.cacheDirectory}image-clipboard-${Date.now()}.${extension}`;

  if (uri.startsWith("data:image/")) {
    const base64 = uri.split(",")[1];
    if (!base64) {
      throw new Error("Image data is empty.");
    }
    await FileSystem.writeAsStringAsync(targetUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return targetUri;
  }

  const result = await FileSystem.downloadAsync(uri, targetUri);
  return result.uri;
}

export async function copyImageToClipboard(uri: string) {
  if (!ImageClipboard?.copyImage) {
    throw new Error("Image clipboard is not available in this build.");
  }

  const localUri = await getLocalImageUri(uri);
  await ImageClipboard.copyImage(localUri);
}
