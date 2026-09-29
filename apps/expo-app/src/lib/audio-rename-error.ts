export function getAudioRenameErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("No procedure found") && message.includes("updateMediaTitleOverride")) {
    return "Rename is not available on the API yet. Please try again after the update finishes.";
  }
  if (/fetch failed|network request failed|failed to fetch/i.test(message)) {
    return "Could not reach the API. Check your connection and try again.";
  }
  return "Could not save the new name. Please try again.";
}
