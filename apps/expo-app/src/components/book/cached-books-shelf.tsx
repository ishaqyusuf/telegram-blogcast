import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable } from "@/components/ui/pressable";
import { listCachedBookLibrary } from "@/lib/book-cache-reader";
import { useAuthContext } from "@/hooks/use-auth";
import { bookCacheScopeForUser } from "@/lib/book-cache-session";
import { useTranslation } from "@/lib/i18n";
import { useBookDownloadProgress } from "@/lib/book-cache-download-service";

type Book = { id: number; nameAr: string | null; nameEn: string | null; pageCount: number; firstPageId: number | null; pinned: number };

export function CachedBooksShelf() {
	const router = useRouter();
	const { profile } = useAuthContext();
	const scope = bookCacheScopeForUser(profile?.user?.id);
	const { isRtl } = useTranslation();
	const completed = useBookDownloadProgress((state) => state.active?.completed);
	const [state, setState] = useState<{ scope: string; books: Book[] }>({ scope, books: [] });
	useFocusEffect(useCallback(() => {
		let active = true;
		void listCachedBookLibrary(scope).then((books) => { if (active) setState({ scope, books }); }).catch((error) => console.warn("[Book cache] local library unavailable", error));
		return () => { active = false; };
	}, [scope, completed]));
	if (state.scope !== scope || !state.books.length) return null;
	return <View className="gap-2 py-2">
		<View className="flex-row items-center justify-between px-4">
			<Text className="font-semibold text-foreground">{isRtl ? "على هذا الجهاز" : "On This Device"}</Text>
			<Pressable onPress={() => router.push("/book-storage" as any)} className="p-2"><Text className="text-sm text-primary">{isRtl ? "التخزين" : "Storage"}</Text></Pressable>
		</View>
		<ScrollView horizontal contentContainerClassName="gap-3 px-4" showsHorizontalScrollIndicator={false}>
			{state.books.map((book) => <View key={book.id} className="w-56 gap-2 rounded-xl bg-card p-3">
				<Pressable disabled={!book.firstPageId} onPress={() => router.push(`/books/${book.id}/reader/${book.firstPageId}` as any)} className="gap-2">
					<Text numberOfLines={2} className="font-semibold text-foreground">{book.nameAr ?? book.nameEn ?? `Book #${book.id}`}</Text>
					<Text className="text-sm text-muted-foreground">{book.pageCount} {isRtl ? "صفحة محفوظة" : "saved pages"}</Text>
				</Pressable>
				<Pressable onPress={() => router.push(`/books/${book.id}/chapters` as any)} className="py-2"><Text className="text-sm text-primary">{isRtl ? "الفهرس" : "Chapter Tree"}</Text></Pressable>
			</View>)}
		</ScrollView>
	</View>;
}
