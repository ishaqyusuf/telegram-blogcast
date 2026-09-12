import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Text, View } from "react-native";

import { Pressable } from "@/components/ui/pressable";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";

export type AlbumSuggestionChannel = {
  id: number;
  title?: string | null;
  username?: string | null;
};

export function getAlbumSuggestionChannelLabel(
  channel?: AlbumSuggestionChannel | null,
) {
  return channel?.title || (channel?.username ? `@${channel.username}` : null);
}

export function AlbumSuggestionChannelFilterSheet({
  visible,
  channels,
  selectedChannelId,
  lockedChannelId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  channels: AlbumSuggestionChannel[];
  selectedChannelId?: number;
  lockedChannelId?: number;
  onClose: () => void;
  onSelect: (channelId: number) => void;
}) {
  const colors = useColors();
  const selectableChannels = lockedChannelId
    ? channels.filter((channel) => channel.id === lockedChannelId)
    : channels;

  return (
    <FloatingBottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel="Filter album suggestions by channel"
      title="Suggestion channel"
      snapPoints={["64%"]}
      enableDynamicSizing={false}
      scrollableContent
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 24,
          gap: 12,
        }}
      >
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
          {lockedChannelId
            ? "This album is linked to one channel, so suggestions stay within it."
            : "Choose the channel that should supply suggestions for this album."}
        </Text>

        <View style={{ gap: 8 }}>
          {selectableChannels.map((channel) => {
            const selected = channel.id === selectedChannelId;
            const channelLabel =
              getAlbumSuggestionChannelLabel(channel) || `Channel ${channel.id}`;
            return (
              <Pressable
                key={channel.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Use ${channelLabel} for album suggestions`}
                onPress={() => onSelect(channel.id)}
                haptic
                style={{
                  minHeight: 52,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  borderRadius: 14,
                  backgroundColor: selected
                    ? withAlpha(colors.primary, 0.1)
                    : colors.card,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <Icon
                  name={selected ? "CheckCircle2" : "Circle"}
                  size={20}
                  color={selected ? colors.primary : colors.mutedForeground}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    numberOfLines={2}
                    style={{ color: colors.foreground, fontWeight: "800" }}
                  >
                    {channelLabel}
                  </Text>
                  {channel.username && channel.title ? (
                    <Text
                      numberOfLines={1}
                      style={{ color: colors.mutedForeground, fontSize: 11 }}
                    >
                      @{channel.username}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}

          {selectableChannels.length === 0 ? (
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 13,
                textAlign: "center",
                paddingVertical: 24,
              }}
            >
              No channels are available.
            </Text>
          ) : null}
        </View>
      </BottomSheetScrollView>
    </FloatingBottomSheet>
  );
}
