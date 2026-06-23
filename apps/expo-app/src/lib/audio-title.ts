type AudioTitleValue = string | null | undefined;

type AudioTitleMedia = {
  title?: AudioTitleValue;
  fileName?: AudioTitleValue;
  displayName?: AudioTitleValue;
  file?: {
    fileName?: AudioTitleValue;
  } | null;
  blog?: {
    content?: AudioTitleValue;
  } | null;
};

type AudioTitleSource = {
  caption?: AudioTitleValue;
  content?: AudioTitleValue;
  audio?: AudioTitleMedia | null;
  media?: AudioTitleMedia | AudioTitleMedia[] | null;
  medias?: AudioTitleMedia[] | null;
};

function clean(value: AudioTitleValue) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function appendDistinct(primary: string | null, secondary: string | null) {
  if (!primary) return secondary;
  if (!secondary || primary === secondary) return primary;
  return `${primary} - ${secondary}`;
}

export function getAudioDisplayTitle(
  source: AudioTitleSource | null | undefined,
  fallback = "Audio",
) {
  const media = Array.isArray(source?.media)
    ? (source.media[0] ?? null)
    : (source?.media ?? source?.medias?.[0] ?? null);
  const audio = source?.audio ?? null;

  const primary = clean(source?.caption) ?? clean(source?.content);
  const mediaLabel =
    clean(audio?.fileName) ??
    clean(media?.file?.fileName) ??
    clean(media?.fileName) ??
    clean(audio?.displayName) ??
    clean(media?.displayName) ??
    clean(audio?.title) ??
    clean(media?.title) ??
    null;

  return (
    appendDistinct(primary, mediaLabel) ?? clean(media?.blog?.content) ?? fallback
  );
}
