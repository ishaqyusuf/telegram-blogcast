import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable } from "@/components/ui/pressable";
import { useColors } from "@/hooks/use-color";
import { useAuthContext } from "@/hooks/use-auth";
import { listCachedBookLibrary } from "@/lib/book-cache-reader";
import { bookCacheScopeForUser } from "@/lib/book-cache-session";
import { useTranslation } from "@/lib/i18n";
import { useBookDownloadProgress } from "@/lib/book-cache-download-service";
import { useBookOfflineStore } from "@/store/book-offline-store";

type Book = { id: number; nameAr: string | null; nameEn: string | null; pageCount: number; firstPageId: number | null; pinned: number };

export function CachedBooksShelf() {
	const router = useRouter();
	const colors = useColors();
	const { profile } = useAuthContext();
	const scope = bookCacheScopeForUser(profile?.user?.id);
	const { isRtl } = useTranslation();
	const completed = useBookDownloadProgress((state) => state.active?.completed);
	const readingProgress = useBookOfflineStore((state) => state.readingProgress);
	const readingProgressUpdatedAt = useBookOfflineStore((state) => state.readingProgressUpdatedAt);
	const [state, setState] = useState<{ scope: string; books: Book[] }>({ scope, books: [] });
	useFocusEffect(useCallback(() => {
		let active = true;
		void listCachedBookLibrary(scope).then((books) => { if (active) setState({ scope, books }); }).catch((error) => console.warn("[Book cache] local library unavailable", error));
		return () => { active = false; };
	}, [scope, completed]));
	if (state.scope !== scope || !state.books.length) return null;
	const book = [...state.books]
		.filter((item) => item.firstPageId != null)
		.sort((a, b) => (readingProgressUpdatedAt[b.id] ?? 0) - (readingProgressUpdatedAt[a.id] ?? 0) || b.pageCount - a.pageCount)[0];
	if (!book?.firstPageId) return null;
	const title = book.nameAr ?? book.nameEn ?? `Book #${book.id}`;
	const targetPageId = readingProgress[book.id] ?? book.firstPageId;
	return <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, gap: 8 }}>
		<Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }}>{isRtl ? "مكتبتك" : "YOUR LIBRARY"}</Text>
		<Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "800", marginTop: -6 }}>{isRtl ? "متابعة القراءة" : "Keep reading"}</Text>
		<Pressable onPress={() => router.push(`/books/${book.id}/reader/${targetPageId}`)} accessibilityRole="button" accessibilityLabel={isRtl ? `متابعة ${title}` : `Continue reading ${title}`} style={{ backgroundColor: "#173F34", borderRadius: 17, padding: 15, flexDirection: "row", alignItems: "center", gap: 14 }}>
			<View style={{ width: 72, height: 101, borderRadius: 7, backgroundColor: "#225C43", alignItems: "center", justifyContent: "center", padding: 6 }}>
				<Text style={{ color: "#D9C27E", fontSize: 22 }}>۞</Text>
				<Text numberOfLines={3} style={{ color: "#F7E9C6", fontFamily: "serif", fontSize: 12, fontWeight: "700", textAlign: "center", writingDirection: "rtl" }}>{title}</Text>
			</View>
			<View style={{ flex: 1, gap: 6 }}>
				<Text style={{ color: "#C7DFCB", fontSize: 10, fontWeight: "700" }}>{isRtl ? `${book.pageCount} صفحة محفوظة على الجهاز` : `ON THIS DEVICE · ${book.pageCount} PAGES SAVED`}</Text>
				<Text numberOfLines={2} style={{ color: "#FFFFFF", fontFamily: "serif", fontSize: 17, fontWeight: "700", lineHeight: 24, textAlign: "right", writingDirection: book.nameAr ? "rtl" : "ltr" }}>{title}</Text>
				<Text style={{ color: "#C7DFCB", fontSize: 11 }}>{isRtl ? "العودة إلى آخر صفحة ←" : "Return to your last page →"}</Text>
			</View>
		</Pressable>
		<Pressable onPress={() => router.push("/book-storage")} accessibilityRole="button" style={{ alignSelf: "flex-end", paddingVertical: 3 }}>
			<Text style={{ color: "#207453", fontSize: 12, fontWeight: "600" }}>{isRtl ? "المكتبة دون اتصال ←" : "Offline library →"}</Text>
		</Pressable>
	</View>;
}
