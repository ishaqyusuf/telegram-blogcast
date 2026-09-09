import { expect, test } from "bun:test";
import { acquireBookCacheMaintenance, acquireBookCacheWorker, useBookCacheMaintenance } from "./book-cache-maintenance-state";

test("downloads and mirrors may overlap but exclude maintenance until both settle", () => {
	const download = acquireBookCacheWorker();
	const mirror = acquireBookCacheWorker();
	expect(download).not.toBeNull();
	expect(mirror).not.toBeNull();
	expect(acquireBookCacheMaintenance()).toBeNull();
	download!();
	download!();
	expect(acquireBookCacheMaintenance()).toBeNull();
	mirror!();
	const cleanup = acquireBookCacheMaintenance();
	expect(cleanup).not.toBeNull();
	expect(acquireBookCacheWorker()).toBeNull();
	cleanup!();
	const next = acquireBookCacheWorker();
	expect(next).not.toBeNull();
	next!();
});

test("maintenance stays exclusive until its owner settles and stale releases cannot unlock new work", () => {
	const releaseFirst = acquireBookCacheMaintenance();
	expect(releaseFirst).not.toBeNull();
	expect(useBookCacheMaintenance.getState().busy).toBe(true);
	expect(acquireBookCacheMaintenance()).toBeNull();
	releaseFirst!();
	expect(useBookCacheMaintenance.getState().busy).toBe(false);
	const releaseSecond = acquireBookCacheMaintenance();
	expect(releaseSecond).not.toBeNull();
	releaseFirst!();
	expect(useBookCacheMaintenance.getState().busy).toBe(true);
	releaseSecond!();
	expect(useBookCacheMaintenance.getState().busy).toBe(false);
});
