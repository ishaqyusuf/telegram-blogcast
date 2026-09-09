import { deviceAnnotation, type DeviceAnnotation } from "@acme/utils/book-annotation";
import type { createBookAnnotationRepository } from "./book-annotation-repository";

type Repository = ReturnType<typeof createBookAnnotationRepository>;
type RemoteAnnotation = DeviceAnnotation & { bookId: number };
export interface AnnotationTransport {
  capabilities(): Promise<{ protocol: number; ownership: string }>;
  push(items: DeviceAnnotation[]): Promise<RemoteAnnotation[]>;
  list(afterId?: string): Promise<{ items: RemoteAnnotation[]; nextCursor: string | null }>;
}
export function annotationWireValue(value: { localId: string; pageId: number; revision: number; deleted: boolean; payload: unknown }): DeviceAnnotation {
  const { localId, pageId, revision, deleted, payload } = value;
  return deviceAnnotation.parse({ localId, pageId, revision, deleted, payload });
}

export async function syncDeviceAnnotations(repository: Repository, transport: AnnotationTransport, scope: string, bookId: number, signal: AbortSignal) {
  const active = () => { if (signal.aborted) throw new Error("Private annotation sync paused; local changes are safe."); };
  active();
  const capability = await transport.capabilities();
  active();
  if (capability.protocol !== 1 || capability.ownership !== "device") throw new Error("Private annotation sync is not supported by this server. Changes remain on this device.");
  let uploaded = 0;
  for (let batch = 0; batch < 10; batch++) {
    active();
    const pending = await repository.pending(scope, bookId);
    if (!pending.length) break;
    const items = pending.map(annotationWireValue);
    try {
      active();
      const response = await transport.push(items);
      active();
      if (response.length !== items.length || new Set(response.map((item) => item.localId)).size !== items.length) throw new Error("Incomplete annotation acknowledgement. Retry safely.");
      const saved = response.map((item) => {
        if (item.bookId !== bookId) throw new Error("Annotation acknowledgement belongs to another book.");
        const normalized = annotationWireValue(item);
        const sent = items.find((candidate) => candidate.localId === item.localId);
        if (!sent || JSON.stringify(normalized) !== JSON.stringify(sent)) throw new Error("Annotation conflict: the saved revision differs. Local changes were retained.");
        return normalized;
      });
      await repository.acknowledge(scope, bookId, saved);
      uploaded += saved.length;
    } catch (error) {
      if (!signal.aborted) for (const item of items) await repository.fail(scope, bookId, item, error instanceof Error ? error.message : "Private sync failed.");
      throw error;
    }
  }
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    active();
    const response = await transport.list(cursor);
    active();
    if (response.items.length > 100) throw new Error("Annotation response exceeded the supported limit.");
    const items = response.items.map((item) => {
      if (item.bookId !== bookId) throw new Error("Annotation response belongs to another book.");
      return annotationWireValue(item);
    });
    await repository.mergeRemote(scope, bookId, items);
    if (response.nextCursor === null) return { uploaded };
    if (!response.nextCursor || (cursor && response.nextCursor <= cursor)) throw new Error("Annotation pagination did not advance.");
    cursor = response.nextCursor;
  }
  throw new Error("Annotation refresh reached its safety limit; saved changes are retained.");
}
