export async function commitAnnotationMutation<T>(
  persist: () => Promise<T>,
  afterCommit: () => Promise<void>,
  onRefreshFailure: () => void,
): Promise<T> {
  const result = await persist();
  // A refresh failure cannot undo a durable write or make it safe to create again.
  try {
    await afterCommit();
  } catch {
    onRefreshFailure();
  }
  return result;
}
