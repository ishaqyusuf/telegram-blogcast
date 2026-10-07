import { create } from "zustand";

type GlobalAudioBarState = {
	hidden: boolean;
	scrollHidden: boolean;
	scrollOwnerId: string | null;
	audioDetailPlayerVisible: boolean;
	viewedAudioMediaId: number | null;
	setHidden: (hidden: boolean) => void;
	setScrollHidden: (hidden: boolean, ownerId?: string) => void;
	setAudioDetailPlayerVisible: (visible: boolean) => void;
	setViewedAudioMediaId: (mediaId: number | null) => void;
};

export const useGlobalAudioBarStore = create<GlobalAudioBarState>((set) => ({
	hidden: false,
	scrollHidden: false,
	scrollOwnerId: null,
	audioDetailPlayerVisible: false,
	viewedAudioMediaId: null,
	setHidden: (hidden) => set({ hidden }),
	setScrollHidden: (scrollHidden, ownerId) =>
		set((state) => {
			if (!scrollHidden && ownerId && state.scrollOwnerId !== ownerId)
				return state;
			return {
				scrollHidden,
				scrollOwnerId: scrollHidden ? (ownerId ?? null) : null,
			};
		}),
	setAudioDetailPlayerVisible: (audioDetailPlayerVisible) =>
		set({ audioDetailPlayerVisible }),
	setViewedAudioMediaId: (viewedAudioMediaId) => set({ viewedAudioMediaId }),
}));
