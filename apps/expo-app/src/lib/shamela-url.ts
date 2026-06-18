const SHAMELA_ORIGIN = "https://shamela.ws";

export function toAbsoluteShamelaUrl(pathOrUrl: string) {
  const value = pathOrUrl.trim();
  if (!value) return value;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value)) return value;
  return `${SHAMELA_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`;
}
