import { Pressable, ScrollView, Text, View } from "react-native";
import { BottomSheetModal, BottomSheetView, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, useMemo } from "react";

type Footnote = {
  id: number;
  marker: string;
  content: string;
  type?: string | null;
};

type Props = {
  footnotes: Footnote[];
  highlightedMarker?: string | null;
};

export const FootnotesSheet = forwardRef<BottomSheetModal, Props>(
  ({ footnotes, highlightedMarker }, ref) => {
    const snapPoints = useMemo(() => ["40%", "70%"], []);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backgroundStyle={{ backgroundColor: "#1e1e1e" }}
        handleIndicatorStyle={{ backgroundColor: "#444" }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: "#fff",
              marginBottom: 12,
              writingDirection: "rtl",
              textAlign: "right",
            }}
          >
            الحواشي
          </Text>
          {footnotes.length === 0 ? (
            <Text style={{ color: "#b3b3b3", textAlign: "center", marginTop: 24 }}>
              لا توجد حواشي في هذه الصفحة
            </Text>
          ) : (
            <View style={{ gap: 12 }}>
              {footnotes.map((fn) => {
                const isHighlighted = highlightedMarker === fn.marker;
                return (
                  <View
                    key={fn.id}
                    style={{
                      backgroundColor: isHighlighted ? "rgba(29,185,84,0.15)" : "rgba(255,255,255,0.05)",
                      borderRadius: 8,
                      padding: 12,
                      borderWidth: isHighlighted ? 1 : 0,
                      borderColor: isHighlighted ? "#1DB954" : "transparent",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row-reverse",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: "#1DB954",
                          borderRadius: 12,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: "#000", fontWeight: "700" }}>
                          {fn.marker}
                        </Text>
                      </View>
                      {fn.type && (
                        <Text style={{ fontSize: 11, color: "#b3b3b3" }}>{fn.type}</Text>
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        lineHeight: 26,
                        color: "#e8e8e8",
                        writingDirection: "rtl",
                        textAlign: "right",
                      }}
                    >
                      {fn.content}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

FootnotesSheet.displayName = "FootnotesSheet";
