import { useCallback, useEffect, useId } from "react";
import { create } from "zustand";

type FloatingBottomSheetState = {
	openSheetIds: Record<string, true>;
	setSheetOpen: (id: string, open: boolean) => void;
};

export const useFloatingBottomSheetStore = create<FloatingBottomSheetState>(
	(set) => ({
		openSheetIds: {},
		setSheetOpen: (id, open) =>
			set((state) => {
				const isRegistered = Boolean(state.openSheetIds[id]);
				if (isRegistered === open) return state;
				if (open) {
					return {
						openSheetIds: {
							...state.openSheetIds,
							[id]: true,
						},
					};
				}

				const { [id]: _closed, ...openSheetIds } = state.openSheetIds;
				return { openSheetIds };
			}),
	}),
);

export function useFloatingBottomSheetRegistration() {
	const sheetId = useId();
	const setSheetOpen = useFloatingBottomSheetStore(
		(state) => state.setSheetOpen,
	);

	const markSheetPresented = useCallback(() => {
		setSheetOpen(sheetId, true);
	}, [setSheetOpen, sheetId]);

	const markSheetDismissed = useCallback(() => {
		setSheetOpen(sheetId, false);
	}, [setSheetOpen, sheetId]);

	useEffect(() => markSheetDismissed, [markSheetDismissed]);

	return { markSheetDismissed, markSheetPresented };
}
