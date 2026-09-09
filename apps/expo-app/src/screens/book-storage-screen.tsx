import { useEffect, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeArea } from "@/components/safe-area";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { getBookCacheRepository } from "@/db/book-cache-db";
import { chooseBookFolder, disconnectBookFolder, getBookFolder, type BookFolderConfiguration } from "@/lib/book-cache-folder";
import { PREFERRED_BOOKS_DIRECTORY } from "@/lib/book-cache-format";
import { cancelBookFolderSync, syncBookFolder, useBookFolderSync } from "@/lib/book-cache-sync";
import { useTranslation } from "@/lib/i18n";
import { BookDownloadButton } from "@/components/book/book-download-button";
import { useBookDownloadProgress } from "@/lib/book-cache-download-service";
import type { BookDownload } from "@/lib/book-cache-download";
import { useAuthContext } from "@/hooks/use-auth";
import { bookCacheScopeForUser } from "@/lib/book-cache-session";
import { BookCacheMaintenance } from "@/components/book/book-cache-maintenance";
import { useBookCacheMaintenance } from "@/lib/book-cache-maintenance-state";

export default function BookStorageScreen() {
	const router = useRouter();
	const { isRtl } = useTranslation();
	const [folder, setFolder] = useState<BookFolderConfiguration | null>(null);
	const [summary, setSummary] = useState({ pages: 0, trees: 0, bytes: 0, pending: 0, failed: 0 });
	const [message, setMessage] = useState<string | null>(null);
	const [choosing, setChoosing] = useState(false);
	const [maintaining, setMaintaining] = useState(false);
	const maintenanceWorking = useBookCacheMaintenance((state) => state.busy);
	const [refresh, setRefresh] = useState(0);
	const sync = useBookFolderSync();
	const downloading = useBookDownloadProgress((state) => state.working);
	const { profile } = useAuthContext();
	const scope = bookCacheScopeForUser(profile?.user?.id);
	const [downloads, setDownloads] = useState<BookDownload[]>([]);
	const label = (en: string, ar: string) => isRtl ? ar : en;
	useEffect(() => {
		let active = true;
		async function load() {
			try {
				const configuration = await getBookFolder();
				const repository = await getBookCacheRepository();
				const state = await repository.storageSummary(scope);
				const jobs = await repository.listDownloads(scope);
				if (active) { setFolder(configuration); setSummary(state); setDownloads(jobs); }
			} catch (error) { if (active) setMessage(error instanceof Error ? error.message : "Could not read storage status."); }
		}
		void load();
		return () => { active = false; };
	}, [sync.working, downloading, scope, refresh]);
	async function selectFolder() {
		if (choosing || maintaining || maintenanceWorking || sync.working) return;
		setChoosing(true);
		setMessage(null);
		try {
			const selected = await chooseBookFolder();
			if (selected) { setFolder(selected); await syncBookFolder(true); }
		} catch (error) { setMessage(error instanceof Error ? error.message : "Could not select the Books folder."); }
		finally { setChoosing(false); }
	}
	return (
		<SafeArea>
			<View className="flex-row items-center gap-3 px-4 py-3">
				<Pressable accessibilityLabel={label("Back", "رجوع")} onPress={() => router.back()} className="p-2"><Icon name="ChevronLeft" size={22} className="text-foreground" /></Pressable>
				<Text className="flex-1 text-xl font-semibold text-foreground">{label("Book Storage", "تخزين الكتب")}</Text>
			</View>
			<ScrollView contentContainerClassName="gap-5 px-5 pb-12">
				<View className="gap-2 rounded-2xl bg-card p-4">
					<Text className="text-base font-semibold text-foreground">{label("Available on this device", "متاح على هذا الجهاز")}</Text>
					<Text className="text-sm text-muted-foreground">{label(`${summary.pages} pages · ${summary.trees} chapter trees`, `${summary.pages} صفحة · ${summary.trees} فهرس`)}</Text>
					<Text className="text-sm text-muted-foreground">{(summary.bytes / 1024 / 1024).toFixed(1)} MB {label("of current cached content (excludes legacy archives, backups and database overhead)", "من المحتوى المخزن حاليا (دون الأرشيفات القديمة والنسخ الاحتياطية وحجم قاعدة البيانات)")}</Text>
				</View>
				<View className="gap-3 rounded-2xl bg-card p-4">
					<Text className="text-base font-semibold text-foreground">{label("Portable Books Folder", "مجلد الكتب")}</Text>
					<Text selectable className="text-sm text-muted-foreground">{folder?.path ?? PREFERRED_BOOKS_DIRECTORY}</Text>
					<Text className="text-sm text-muted-foreground">{label("The private database stays inside the app. Public book content is copied here as JSON; highlights, comments and drafts are not exported.", "تبقى قاعدة البيانات داخل التطبيق. ينسخ محتوى الكتب العامة هنا بصيغة JSON دون التظليلات والتعليقات والمسودات.")}</Text>
					{Platform.OS === "android" ? <Pressable disabled={maintaining || maintenanceWorking || choosing || sync.working} onPress={() => void selectFolder()} className="items-center rounded-xl bg-primary px-4 py-3">
						<Text className="font-semibold text-primary-foreground">{choosing ? label("Selecting…", "جار الاختيار…") : label(folder ? "Change Folder" : "Choose Books Folder", folder ? "تغيير المجلد" : "اختيار مجلد الكتب")}</Text>
					</Pressable> : <Text className="text-sm text-muted-foreground">{label("The Android/media location is available on Android only.", "مسار Android/media متاح على أندرويد فقط.")}</Text>}
					{folder && <>
						<Text className="text-sm text-muted-foreground">{label(`${summary.pending} pending files · ${summary.failed} need retry`, `${summary.pending} ملف منتظر · ${summary.failed} بحاجة لإعادة المحاولة`)}</Text>
						<Pressable disabled={maintaining || maintenanceWorking || choosing} onPress={() => sync.working ? cancelBookFolderSync() : void syncBookFolder(true)} className="items-center rounded-xl border border-border px-4 py-3"><Text className="font-semibold text-foreground">{label(sync.working ? "Pause Folder Sync" : sync.paused ? "Resume Folder Sync" : "Sync / Retry Files", sync.working ? "إيقاف المزامنة" : "مزامنة الملفات / إعادة المحاولة")}</Text></Pressable>
						<Pressable disabled={maintaining || maintenanceWorking || sync.working || choosing} onPress={() => { void disconnectBookFolder().then(() => setFolder(null)).catch((error) => setMessage(String(error))); }} className="items-center px-4 py-3"><Text className="text-sm text-muted-foreground">{label("Disconnect Folder (keep files)", "فصل المجلد (مع حفظ الملفات)")}</Text></Pressable>
					</>}
				</View>
				{sync.working && <Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">{label(`${sync.saved} files saved, ${sync.failed} failed. You can keep reading.`, `تم حفظ ${sync.saved} ملف، وتعذر ${sync.failed}. يمكنك مواصلة القراءة.`)}</Text>}
				{downloads.filter((job) => job.scope === scope).map((job) => <View key={job.bookId} className="gap-3 rounded-2xl bg-card p-4">
					<Text className="font-semibold text-foreground">{job.manifest.nameAr ?? job.manifest.nameEn ?? `Book #${job.bookId}`}</Text>
					<BookDownloadButton bookId={job.bookId} />
				</View>)}
				<BookCacheMaintenance key={`${scope}:${folder?.uri ?? "disconnected"}`} scope={scope} folder={folder} disabled={downloading || sync.working || choosing} onChanged={() => setRefresh((value) => value + 1)} onBusy={setMaintaining} />
				{(message || sync.error || sync.failed > 0) && <Text accessibilityRole="alert" className="text-sm text-destructive">{message || sync.error || label("Some files could not be copied. Your database content is safe. Check folder access and retry.", "تعذر نسخ بعض الملفات. المحتوى محفوظ في قاعدة البيانات. تحقق من صلاحية المجلد وأعد المحاولة.")}</Text>}
			</ScrollView>
		</SafeArea>
	);
}
