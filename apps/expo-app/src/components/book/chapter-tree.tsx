import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { useState, useCallback } from "react";
import { ActivityIndicator, LayoutAnimation, Platform, Text, UIManager, View } from "react-native";
import { useTranslation } from "@/lib/i18n";
import { useColors } from "@/hooks/use-color";
import { withAlpha } from "@/lib/theme";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Page = {
  id: number;
  volumeId: number | null;
  chapterTitle: string | null;
  topicTitle: string | null;
  status: string;
  shamelaPageNo: number;
  printedPageNo: number | null;
  shamelaUrl: string | null;
};

type Volume = {
  id: number;
  number: number;
  title: string | null;
};

type Props = {
  pages: Page[];
  volumes: Volume[];
  fetchingPageId: number | null;
  onPagePress: (page: Page) => void;
};

type ChapterGroup = {
  chapterTitle: string;
  pages: Page[];
};

type VolumeSection = {
  volumeId: number | null;
  volume: Volume | null;
  chapters: ChapterGroup[];
  fetchedCount: number;
  totalCount: number;
};

function groupPages(pages: Page[], volumes: Volume[]): VolumeSection[] {
  const fallbackChapter = "__no_chapter__";
  const volumeMap = new Map<number, Volume>(volumes.map((v) => [v.id, v]));

  // Group pages by volumeId
  const byVolume = new Map<number | null, Page[]>();
  for (const page of pages) {
    const key = page.volumeId ?? null;
    if (!byVolume.has(key)) byVolume.set(key, []);
    byVolume.get(key)!.push(page);
  }

  // Sort volume keys: real volumes first (by volume number), then null
  const volumeIds = [...byVolume.keys()].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    const va = volumeMap.get(a)?.number ?? 0;
    const vb = volumeMap.get(b)?.number ?? 0;
    return va - vb;
  });

  return volumeIds.map((volumeId) => {
    const volumePages = byVolume.get(volumeId)!;
    const volume = volumeId != null ? (volumeMap.get(volumeId) ?? null) : null;

    // Group by chapterTitle within this volume
    const byChapter = new Map<string, Page[]>();
    for (const page of volumePages) {
      const key = page.chapterTitle ?? fallbackChapter;
      if (!byChapter.has(key)) byChapter.set(key, []);
      byChapter.get(key)!.push(page);
    }

    const chapters: ChapterGroup[] = [...byChapter.entries()].map(([chapterTitle, cPages]) => ({
      chapterTitle,
      pages: cPages.sort((a, b) => a.shamelaPageNo - b.shamelaPageNo),
    }));

    return {
      volumeId,
      volume,
      chapters,
      fetchedCount: volumePages.filter((p) => p.status === "fetched").length,
      totalCount: volumePages.length,
    };
  });
}

// ─── Topic Row ────────────────────────────────────────────────────────────────
function TopicRow({
  page,
  fetchingPageId,
  onPress,
}: {
  page: Page;
  fetchingPageId: number | null;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  const isLoadingThis = fetchingPageId === page.id;
  const label = page.topicTitle ?? page.chapterTitle ?? t("page");
  const statusColors: Record<string, string> = {
    fetched: colors.primary,
    pending: colors.mutedForeground,
    error: colors.destructive,
  };

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row-reverse",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 14,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: withAlpha(colors.border, 0.6),
        backgroundColor: isLoadingThis ? withAlpha(colors.primary, 0.08) : "transparent",
      }}
    >
      {/* Status dot / spinner */}
      {isLoadingThis ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ width: 16 }} />
      ) : (
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: statusColors[page.status] ?? colors.mutedForeground,
            flexShrink: 0,
          }}
        />
      )}

      {/* Title */}
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          color: page.status === "fetched" ? colors.foreground : colors.mutedForeground,
          writingDirection: "rtl",
          textAlign: "right",
          lineHeight: 20,
        }}
        numberOfLines={2}
      >
        {label}
      </Text>

      {/* Page number / download icon */}
      {page.status === "fetched" ? (
        <Text style={{ fontSize: 11, color: colors.mutedForeground, flexShrink: 0 }}>
          {page.printedPageNo != null
            ? t("pageShort", { number: page.printedPageNo })
            : `#${page.shamelaPageNo}`}
        </Text>
      ) : (
        <Icon name="Download" size={13} className="text-muted-foreground" />
      )}
    </Pressable>
  );
}

// ─── Chapter Group ─────────────────────────────────────────────────────────────
function ChapterGroupRow({
  group,
  volumeId,
  fetchingPageId,
  onPagePress,
}: {
  group: ChapterGroup;
  volumeId: number | null;
  fetchingPageId: number | null;
  onPagePress: (page: Page) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const colors = useColors();

  const fetchedCount = group.pages.filter((p) => p.status === "fetched").length;
  const allFetched = fetchedCount === group.pages.length;
  const noneFetched = fetchedCount === 0;

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext({
      duration: 220,
      create: { type: "easeInEaseOut", property: "opacity" },
      update: { type: "easeInEaseOut" },
      delete: { type: "easeInEaseOut", property: "opacity" },
    });
    setExpanded((v) => !v);
  }, []);

  const badgeColor = allFetched
    ? withAlpha(colors.primary, 0.15)
    : noneFetched
    ? withAlpha(colors.mutedForeground, 0.18)
    : withAlpha(colors.warn, 0.15);

  const badgeTextColor = allFetched ? colors.primary : noneFetched ? colors.mutedForeground : colors.warn;

  return (
    <View>
      <Pressable
        onPress={toggle}
        style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          paddingVertical: 9,
          paddingHorizontal: 12,
          gap: 8,
          backgroundColor: withAlpha(colors.muted, 0.45),
          borderBottomWidth: 1,
          borderBottomColor: withAlpha(colors.border, 0.6),
        }}
      >
        {/* Chevron */}
        <Icon
          name={expanded ? "ChevronDown" : "ChevronLeft"}
          size={14}
          className="text-muted-foreground"
        />

        {/* Chapter title */}
        <Text
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: "600",
            color: colors.foreground,
            writingDirection: "rtl",
            textAlign: "right",
          }}
          numberOfLines={1}
        >
          {group.chapterTitle}
        </Text>

        {/* Fetched count badge */}
        <View
          style={{
            backgroundColor: badgeColor,
            borderRadius: 8,
            paddingHorizontal: 7,
            paddingVertical: 2,
          }}
        >
          <Text style={{ fontSize: 11, color: badgeTextColor, fontWeight: "600" }}>
            {fetchedCount}/{group.pages.length}
          </Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={{ paddingRight: 16 }}>
          {group.pages.map((page) => (
            <TopicRow
              key={page.id}
              page={page}
              fetchingPageId={fetchingPageId}
              onPress={() => onPagePress(page)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Volume Section ────────────────────────────────────────────────────────────
function VolumeSectionRow({
  section,
  fetchingPageId,
  onPagePress,
  isOnly,
}: {
  section: VolumeSection;
  fetchingPageId: number | null;
  onPagePress: (page: Page) => void;
  isOnly: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const colors = useColors();

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext({
      duration: 240,
      create: { type: "easeInEaseOut", property: "opacity" },
      update: { type: "easeInEaseOut" },
      delete: { type: "easeInEaseOut", property: "opacity" },
    });
    setExpanded((v) => !v);
  }, []);

  // If there's only one volume (or no volume grouping), don't show a volume header
  if (isOnly) {
    return (
      <View>
        {section.chapters.map((group) => (
          <ChapterGroupRow
            key={group.chapterTitle}
            group={group}
            volumeId={section.volumeId}
            fetchingPageId={fetchingPageId}
            onPagePress={onPagePress}
          />
        ))}
      </View>
    );
  }

  const label = section.volume
    ? `${t("volume", { number: section.volume.number })}${section.volume.title ? " - " + section.volume.title : ""}`
    : t("withoutVolume");

  return (
    <View style={{ marginBottom: 6 }}>
      {/* Volume header */}
      <Pressable
        onPress={toggle}
        style={{
          flexDirection: "row-reverse",
          alignItems: "center",
          paddingVertical: 11,
          paddingHorizontal: 14,
          backgroundColor: colors.card,
          gap: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Icon
          name={expanded ? "ChevronDown" : "ChevronLeft"}
          size={16}
          className="text-muted-foreground"
        />

        <Text
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: "700",
            color: colors.foreground,
            writingDirection: "rtl",
            textAlign: "right",
          }}
          numberOfLines={1}
        >
          {label}
        </Text>

        {/* Progress badge */}
        <View
          style={{
            backgroundColor:
              section.fetchedCount === section.totalCount
                ? withAlpha(colors.primary, 0.18)
                : withAlpha(colors.muted, 0.65),
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color:
                section.fetchedCount === section.totalCount ? colors.primary : colors.mutedForeground,
            }}
          >
            {section.fetchedCount}/{section.totalCount}
          </Text>
        </View>
      </Pressable>

      {/* Chapter groups inside this volume */}
      {expanded && (
        <View
          style={{
            marginTop: 2,
            borderRadius: 8,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {section.chapters.map((group) => (
            <ChapterGroupRow
              key={group.chapterTitle}
              group={group}
              volumeId={section.volumeId}
              fetchingPageId={fetchingPageId}
              onPagePress={onPagePress}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────
export function ChapterTree({ pages, volumes, fetchingPageId, onPagePress }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const sections = groupPages(pages, volumes);

  if (sections.length === 0) {
    return (
      <View style={{ paddingVertical: 32, alignItems: "center" }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{t("noChapters")}</Text>
      </View>
    );
  }

  const isOnly = sections.length === 1;

  return (
    <View style={{ gap: 6 }}>
      {sections.map((section) => (
        <VolumeSectionRow
          key={section.volumeId ?? "no-volume"}
          section={section}
          fetchingPageId={fetchingPageId}
          onPagePress={onPagePress}
          isOnly={isOnly}
        />
      ))}
    </View>
  );
}
