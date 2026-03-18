import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { useState, useCallback } from "react";
import { ActivityIndicator, LayoutAnimation, Platform, Text, UIManager, View } from "react-native";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STATUS_COLORS: Record<string, string> = {
  fetched: "#1DB954",
  pending: "#4b5563",
  error:   "#ef4444",
};

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
      const key = page.chapterTitle ?? "(بلا فصل)";
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
  const isLoadingThis = fetchingPageId === page.id;
  const label = page.topicTitle ?? page.chapterTitle ?? "صفحة";

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
        borderBottomColor: "rgba(255,255,255,0.04)",
        backgroundColor: isLoadingThis ? "rgba(29,185,84,0.07)" : "transparent",
      }}
    >
      {/* Status dot / spinner */}
      {isLoadingThis ? (
        <ActivityIndicator size="small" color="#1DB954" style={{ width: 16 }} />
      ) : (
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: STATUS_COLORS[page.status] ?? "#4b5563",
            flexShrink: 0,
          }}
        />
      )}

      {/* Title */}
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          color: page.status === "fetched" ? "#e8e8e8" : "#6b7280",
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
        <Text style={{ fontSize: 11, color: "#4b5563", flexShrink: 0 }}>
          {page.printedPageNo != null ? `ص ${page.printedPageNo}` : `#${page.shamelaPageNo}`}
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
    ? "rgba(29,185,84,0.15)"
    : noneFetched
    ? "rgba(75,85,99,0.3)"
    : "rgba(255,165,0,0.15)";

  const badgeTextColor = allFetched ? "#1DB954" : noneFetched ? "#6b7280" : "#f59e0b";

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
          backgroundColor: "rgba(255,255,255,0.03)",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.05)",
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
            color: "#c0c0c0",
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
  const [expanded, setExpanded] = useState(true);

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
    ? `الجزء ${section.volume.number}${section.volume.title ? " — " + section.volume.title : ""}`
    : "بدون جزء";

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
          backgroundColor: "#1E1E1E",
          gap: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.07)",
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
            color: "#fff",
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
                ? "rgba(29,185,84,0.18)"
                : "rgba(255,255,255,0.08)",
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
                section.fetchedCount === section.totalCount ? "#1DB954" : "#9ca3af",
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
            borderColor: "rgba(255,255,255,0.05)",
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
  const sections = groupPages(pages, volumes);

  if (sections.length === 0) {
    return (
      <View style={{ paddingVertical: 32, alignItems: "center" }}>
        <Text style={{ color: "#4b5563", fontSize: 14 }}>لا توجد فصول</Text>
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
