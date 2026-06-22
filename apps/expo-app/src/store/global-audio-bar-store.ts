import { create } from "zustand";

type GlobalAudioBarState = {
  hidden: boolean;
  scrollHidden: boolean;
  setHidden: (hidden: boolean) => void;
  setScrollHidden: (hidden: boolean) => void;
};

export const useGlobalAudioBarStore = create<GlobalAudioBarState>((set) => ({
  hidden: false,
  scrollHidden: false,
  setHidden: (hidden) => set({ hidden }),
  setScrollHidden: (scrollHidden) => set({ scrollHidden }),
}));
