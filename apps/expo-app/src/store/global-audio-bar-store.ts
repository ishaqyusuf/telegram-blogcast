import { create } from "zustand";

type GlobalAudioBarState = {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
};

export const useGlobalAudioBarStore = create<GlobalAudioBarState>((set) => ({
  hidden: false,
  setHidden: (hidden) => set({ hidden }),
}));
