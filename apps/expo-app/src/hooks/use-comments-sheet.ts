import { create } from "zustand";

type CommentsSheetStore = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export const useCommentsSheet = create<CommentsSheetStore>((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
