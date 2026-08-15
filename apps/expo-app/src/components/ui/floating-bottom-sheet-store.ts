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
