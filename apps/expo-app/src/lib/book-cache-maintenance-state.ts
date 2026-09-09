import { create } from "zustand";

export const useBookCacheMaintenance = create<{ busy: boolean }>(() => ({ busy: false }));
let workers = 0;

// Downloads and mirrors can run together; destructive maintenance must wait for both.
export function acquireBookCacheWorker(): (() => void) | null {
	if (useBookCacheMaintenance.getState().busy) return null;
	workers++;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		workers--;
	};
}

export function acquireBookCacheMaintenance(): (() => void) | null {
	if (workers > 0 || useBookCacheMaintenance.getState().busy) return null;
	useBookCacheMaintenance.setState({ busy: true });
	let released = false;
	return () => {
		if (released) return;
		released = true;
		useBookCacheMaintenance.setState({ busy: false });
	};
}
