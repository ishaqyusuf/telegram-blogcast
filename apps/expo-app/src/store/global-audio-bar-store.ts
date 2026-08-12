import { create } from "zustand";

type GlobalAudioBarState = {
  hidden: boolean;
  scrollHidden: boolean;
  audioDetailPlayerVisible: boolean;
  setHidden: (hidden: boolean) => void;
  setScrollHidden: (hidden: boolean) => void;
  setAudioDetailPlayerVisible: (visible: boolean) => void;
};

export const useGlobalAudioBarStore = create<GlobalAudioBarState>((set) => ({
  hidden: false,
  scrollHidden: false,
  audioDetailPlayerVisible: false,
  setHidden: (hidden) => set({ hidden }),
  setScrollHidden: (scrollHidden) => set({ scrollHidden }),
  setAudioDetailPlayerVisible: (audioDetailPlayerVisible) =>
    set({ audioDetailPlayerVisible }),
}));
