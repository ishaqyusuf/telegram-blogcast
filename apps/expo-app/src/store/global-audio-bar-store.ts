import { create } from "zustand";

type GlobalAudioBarState = {
  hidden: boolean;
  scrollHidden: boolean;
  audioDetailPlayerVisible: boolean;
	viewedAudioMediaId: number | null;
  setHidden: (hidden: boolean) => void;
  setScrollHidden: (hidden: boolean) => void;
  setAudioDetailPlayerVisible: (visible: boolean) => void;
	setViewedAudioMediaId: (mediaId: number | null) => void;
};

export const useGlobalAudioBarStore = create<GlobalAudioBarState>((set) => ({
  hidden: false,
  scrollHidden: false,
  audioDetailPlayerVisible: false,
	viewedAudioMediaId: null,
  setHidden: (hidden) => set({ hidden }),
  setScrollHidden: (scrollHidden) => set({ scrollHidden }),
  setAudioDetailPlayerVisible: (audioDetailPlayerVisible) =>
    set({ audioDetailPlayerVisible }),
	setViewedAudioMediaId: (viewedAudioMediaId) => set({ viewedAudioMediaId }),
}));
