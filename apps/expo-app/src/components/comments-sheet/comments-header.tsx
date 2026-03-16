import { Pressable } from "@/components/ui/pressable";
import { Text, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import type { CommentsSheetState } from "./index";

interface CommentsHeaderProps {
  state: CommentsSheetState;
  onClose: () => void;
}

export function CommentsHeader({ state, onClose }: CommentsHeaderProps) {
  const {
    comments,
    isLoading,
    searchVisible,
    setSearchVisible,
    reorderMode,
    setReorderMode,
    arrangementMode,
    setArrangementMode,
    blogId,
  } = state;

  function handleSortToggle() {
    if (arrangementMode === "default") {
      // Switch to indexed mode and enter reorder mode
      setArrangementMode("indexed");
      setReorderMode(true);
    } else if (reorderMode) {
      // Already in reorder mode → exit reorder (keep indexed)
      setReorderMode(false);
    } else {
      // In indexed mode, not reordering → enter reorder mode
      setReorderMode(true);
    }
  }

  const sortIconName = arrangementMode === "indexed" ? "ListOrdered" : "ArrowUpDown";
  const sortActive = arrangementMode === "indexed" || reorderMode;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: "#121212",
        borderBottomWidth: 1,
        borderBottomColor: "#1e1e1e",
        flexShrink: 0,
        zIndex: 30,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
        {isLoading ? "التعليقات" : `التعليقات (${comments.length})`}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {/* Search toggle */}
        <Pressable
          onPress={() => setSearchVisible(!searchVisible)}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: searchVisible ? "#1e3a2e" : "transparent",
          }}
        >
          <Icon
            name="Search"
            size={18}
            className={searchVisible ? "text-primary" : "text-muted-foreground"}
          />
        </Pressable>

        {/* Sort / reorder toggle */}
        <Pressable
          onPress={handleSortToggle}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: sortActive ? "#1e3a2e" : "transparent",
          }}
        >
          <Icon
            name={sortIconName}
            size={18}
            className={sortActive ? "text-primary" : "text-muted-foreground"}
          />
        </Pressable>

        {/* Close */}
        <Pressable
          onPress={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="X" size={20} className="text-muted-foreground" />
        </Pressable>
      </View>
    </View>
  );
}
