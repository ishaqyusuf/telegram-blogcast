import { Text, View } from "react-native";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { forwardRef, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";

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
    const { t } = useTranslation();
    const colors = useColors();

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: colors.foreground,
              marginBottom: 12,
              writingDirection: "rtl",
              textAlign: "right",
            }}
          >
            {t("footnotes")}
          </Text>
          {footnotes.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 24 }}>
              {t("noFootnotes")}
            </Text>
          ) : (
            <View style={{ gap: 12 }}>
              {footnotes.map((fn) => {
                const isHighlighted = highlightedMarker === fn.marker;
                return (
                  <View
                    key={fn.id}
                    style={{
                      backgroundColor: isHighlighted ? withAlpha(colors.primary, 0.15) : colors.muted,
                      borderRadius: 8,
                      padding: 12,
                      borderWidth: isHighlighted ? 1 : 0,
                      borderColor: isHighlighted ? colors.primary : "transparent",
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
                          backgroundColor: colors.primary,
                          borderRadius: 12,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: colors.primaryForeground, fontWeight: "700" }}>
                          {fn.marker}
                        </Text>
                      </View>
                      {fn.type && (
                        <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{fn.type}</Text>
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        lineHeight: 26,
                        color: colors.foreground,
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
