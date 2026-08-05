import { buildTelegramFileProxy } from "./media-source";

export async function getTelegramFileUrl(fileId: string | number) {
  const url = buildTelegramFileProxy(fileId);
  return url ? { status: "success", url } : { status: "fetch-failed" };
}
