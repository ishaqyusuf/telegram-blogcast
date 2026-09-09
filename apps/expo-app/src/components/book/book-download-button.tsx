import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { useAuthContext } from "@/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { bookCacheScopeForUser } from "@/lib/book-cache-session";
import { getBookCacheRepository } from "@/db/book-cache-db";
import { pauseBookDownload, startBookDownload, useBookDownloadProgress } from "@/lib/book-cache-download-service";
import type { BookDownload } from "@/lib/book-cache-download";
import { useBookCacheMaintenance } from "@/lib/book-cache-maintenance-state";

export function BookDownloadButton({ bookId }: { bookId: number }) {
	const { profile } = useAuthContext();
	const scope = bookCacheScopeForUser(profile?.user?.id);
	const { isRtl } = useTranslation();
	const progress = useBookDownloadProgress();
	const maintaining = useBookCacheMaintenance((state) => state.busy);
	const relevant = progress.requestedScope === scope && progress.requestedBookId === bookId;
	const [stored, setStored] = useState<BookDownload | null>(null);
	const [error, setError] = useState<string | null>(null);
	const active = progress.active?.scope === scope && progress.active.bookId === bookId ? progress.active : null;
	const job = active ?? (stored?.scope === scope && stored.bookId === bookId ? stored : null);
	const busy = progress.working && relevant;
	useEffect(() => {
		let mounted = true;
		void getBookCacheRepository().then((repository) => repository.readDownload(scope, bookId)).then((value) => { if (mounted) setStored(value); }).catch((e) => { if (mounted) setError(String(e)); });
		return () => { mounted = false; };
	}, [bookId, scope, progress.working]);
	const label = (en: string, ar: string) => isRtl ? ar : en;
	return <View className="gap-2">
		<Pressable disabled={maintaining || (progress.working && !relevant)} onPress={() => busy ? pauseBookDownload() : void startBookDownload(bookId)} className="items-center rounded-xl bg-card px-4 py-3">
			<Text className="font-semibold text-primary">{busy ? label("Pause Download", "إيقاف التنزيل") : job?.status === "complete" ? label("Check / Download Updates", "فحص التحديثات وتنزيلها") : job ? label("Resume Download", "استئناف التنزيل") : label("Keep Available Offline", "إتاحة القراءة دون اتصال")}</Text>
		</Pressable>
		{relevant && progress.starting && <Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">{label("Starting download...", "جار بدء التنزيل...")}</Text>}
		{job && <Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">{!job.chaptersSaved ? label("Chapters pending", "الفهرس قيد الانتظار") : label("Chapters saved", "تم حفظ الفهرس")} · {job.completed}/{job.manifest.totalPages} {label("server-available pages", "صفحة متاحة على الخادم")}{job.status === "complete" ? label(" · Snapshot complete", " · اكتمل التنزيل") : ""}</Text>}
		{(error || job?.error || (relevant && progress.error)) && <Text className="text-sm text-destructive">{error || (relevant ? progress.error : null) || job?.error}</Text>}
		{job?.status === "failed" && <Pressable disabled={maintaining || progress.working} onPress={() => void startBookDownload(bookId, true)} className="items-center py-2"><Text className="text-sm text-primary">{label("Restart With Latest Pages (keep saved content)", "البدء بأحدث الصفحات مع الاحتفاظ بالمحفوظ")}</Text></Pressable>}
	</View>;
}
