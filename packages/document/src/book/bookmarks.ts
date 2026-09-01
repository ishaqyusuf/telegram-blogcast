export function normalizeBookmarkedPageIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value.filter(
        (pageId): pageId is number =>
          Number.isInteger(pageId) && Number(pageId) > 0,
      ),
    ),
  );
}

export function toggleBookmarkedPageId(
  current: unknown,
  pageId: number,
): number[] {
  const normalized = normalizeBookmarkedPageIds(current);
  if (!Number.isInteger(pageId) || pageId <= 0) return normalized;

  return normalized.includes(pageId)
    ? normalized.filter((candidate) => candidate !== pageId)
    : [pageId, ...normalized];
}
