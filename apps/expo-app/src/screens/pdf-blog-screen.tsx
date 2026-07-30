import { _trpc } from "@/components/static-trpc";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { getMediaFileUrl } from "@/lib/media-source";
import { storePdf } from "@/lib/pdf-storage";
import { useQuery } from "@/lib/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Pdf from "react-native-pdf";
import { SafeAreaView } from "react-native-safe-area-context";

function isPdfMedia(media: any) {
  const mimeType = String(
    media?.mimeType ??
      media?.file?.mimeType ??
      media?.file?.blobContentType ??
      "",
  ).toLowerCase();
  const fileName = String(
    media?.file?.fileName ?? media?.file?.blobPathname ?? media?.title ?? "",
  ).toLowerCase();

  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("document/") ||
    fileName.endsWith(".pdf")
  );
}

export default function PdfBlogScreen() {
  const { blogId } = useLocalSearchParams<{ blogId?: string }>();
  const router = useRouter();
  const colors = useColors();
  const id = Number(blogId);
  const canQuery = Number.isFinite(id) && id > 0;
  const [attempt, setAttempt] = useState(0);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [localPdfUri, setLocalPdfUri] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);

  const { data: blog, isLoading } = useQuery(
    _trpc.blog.getBlog.queryOptions(
      { id: id || 0 },
      {
        enabled: canQuery,
      },
    ),
  );

  const documentMedia = useMemo(
    () =>
      (blog as any)?.medias?.find(isPdfMedia) ??
      (blog as any)?.medias?.[0] ??
      null,
    [blog],
  );
  const documentUrl = getMediaFileUrl(documentMedia?.file);
  const documentTitle =
    documentMedia?.title ||
    documentMedia?.file?.fileName ||
    (blog as any)?.content?.split("\n").find((line: string) => line.trim()) ||
    "PDF document";
  const documentFileName =
    documentMedia?.file?.fileName || `${documentTitle}.pdf`;

  useEffect(() => {
    if (!documentUrl || !canQuery) return;

    let isActive = true;
    setPdfError(null);
    setLocalPdfUri(null);
    setDownloadProgress(0);
    setCurrentPage(1);
    setPageCount(0);

    void storePdf({
      documentId: id,
      fileName: documentFileName,
      url: documentUrl,
      onProgress: (progress) => {
        if (isActive) setDownloadProgress(progress);
      },
    })
      .then((storedPdf) => {
        if (!isActive) return;
        setDownloadProgress(1);
        setLocalPdfUri(storedPdf.localUri);
      })
      .catch((error) => {
        if (!isActive) return;
        setPdfError(
          error instanceof Error
            ? error.message
            : "The PDF could not be downloaded.",
        );
      });

    return () => {
      isActive = false;
    };
  }, [attempt, canQuery, documentFileName, documentUrl, id]);

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View className="flex-row items-center border-b border-border px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          className="size-11 items-center justify-center rounded-full active:bg-muted"
        >
          <Icon name="ArrowLeft" size={23} className="text-foreground" />
        </Pressable>
        <Text
          className="ml-2 flex-1 text-base font-bold text-foreground"
          numberOfLines={1}
        >
          {documentTitle}
        </Text>
        {pageCount > 0 ? (
          <Text className="ml-3 text-xs font-semibold text-muted-foreground">
            {currentPage} / {pageCount}
          </Text>
        ) : null}
      </View>

      {isLoading || (documentUrl && !localPdfUri && !pdfError) ? (
        <View className="flex-1 items-center justify-center px-8">
          <ActivityIndicator color={colors.primary} />
          <Text className="mt-3 text-sm text-muted-foreground">
            {downloadProgress > 0
              ? `Downloading PDF… ${Math.round(downloadProgress * 100)}%`
              : "Preparing PDF…"}
          </Text>
        </View>
      ) : localPdfUri && !pdfError ? (
        <View style={styles.viewer}>
          <Pdf
            source={{ uri: localPdfUri, cache: false }}
            fitPolicy={0}
            enableDoubleTapZoom
            onLoadComplete={(pages) => {
              setPageCount(pages);
              setPdfError(null);
            }}
            onPageChanged={(page, pages) => {
              setCurrentPage(page);
              setPageCount(pages);
            }}
            onError={(error) => {
              console.error("[pdf] render failed", { error, localPdfUri });
              setPdfError(
                error instanceof Error
                  ? error.message
                  : "The downloaded PDF could not be displayed.",
              );
            }}
            renderActivityIndicator={() => (
              <ActivityIndicator color={colors.primary} />
            )}
            style={[
              styles.pdf,
              {
                backgroundColor: colors.muted,
              },
            ]}
          />
          <View className="flex-row items-center justify-center gap-2 border-t border-border bg-card px-4 py-2">
            <Icon
              name={Platform.OS === "android" ? "Check" : "FileText"}
              size={14}
              className={
                Platform.OS === "android"
                  ? "text-primary"
                  : "text-muted-foreground"
              }
            />
            <Text className="text-xs font-semibold text-muted-foreground">
              {Platform.OS === "android"
                ? "Saved to Android media/document"
                : "PDF saved inside the app"}
            </Text>
          </View>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          {documentUrl ? (
            <>
              <Icon name="AlertCircle" size={40} className="text-destructive" />
              <Text className="mt-4 text-center text-base font-bold text-foreground">
                PDF could not be opened.
              </Text>
              {pdfError ? (
                <Text className="mt-2 text-center text-sm leading-5 text-muted-foreground">
                  {pdfError}
                </Text>
              ) : null}
              <Pressable
                className="mt-6 flex-row items-center gap-2 rounded-full bg-primary px-6 py-3 active:opacity-80"
                onPress={() => setAttempt((value) => value + 1)}
                accessibilityRole="button"
                accessibilityLabel="Retry PDF download"
              >
                <Icon
                  name="RotateCw"
                  size={18}
                  className="text-primary-foreground"
                />
                <Text className="font-bold text-primary-foreground">Retry</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Icon
                name="FileText"
                size={40}
                className="text-muted-foreground"
              />
              <Text className="mt-4 text-center text-base font-bold text-foreground">
                PDF file is not available.
              </Text>
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  viewer: {
    flex: 1,
  },
  pdf: {
    flex: 1,
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
});
