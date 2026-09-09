import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";
import { getBookCacheRepository } from "@/db/book-cache-db";
import { createAndroidBookFiles, type BookFolderConfiguration } from "@/lib/book-cache-folder";
import { restoreBookFiles } from "@/lib/book-cache-restore";
import { useBookDownloadProgress } from "@/lib/book-cache-download-service";
import { useTranslation } from "@/lib/i18n";
import { acquireBookCacheMaintenance, useBookCacheMaintenance } from "@/lib/book-cache-maintenance-state";

export function BookCacheMaintenance({ scope, folder, disabled: externallyDisabled, onChanged, onBusy }: {
	scope: string; folder: BookFolderConfiguration | null; disabled: boolean;
	onChanged: () => void; onBusy: (value: boolean) => void;
}) {
	const { isRtl } = useTranslation();
	const label = (en: string, ar: string) => isRtl ? ar : en;
	const [busy, setBusy] = useState(false);
	const [confirmation, setConfirmation] = useState<number | "automatic" | null>(null);
	const [books, setBooks] = useState<{ id: number; nameAr: string | null; nameEn: string | null }[]>([]);
	const [folderIds, setFolderIds] = useState<number[]>([]);
	const [visible, setVisible] = useState(10);
	const [message, setMessage] = useState<string | null>(null);
	const [refresh, setRefresh] = useState(0);
	const operation = useRef<AbortController | null>(null);
	const mounted = useRef(false);
	const globallyBusy = useBookCacheMaintenance((state) => state.busy);
	const disabled = externallyDisabled || globallyBusy;
	const notifyBusy = useRef(onBusy);
	notifyBusy.current = onBusy;
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			operation.current?.abort();
			notifyBusy.current(false);
		};
	}, []);
	useEffect(() => {
		let active = true;
		void getBookCacheRepository().then((repository) => repository.listCachedBooks(scope)).then((items) => { if (active) setBooks(items); }).catch((e) => { if (active) setMessage(String(e)); });
		return () => { active = false; };
	}, [scope, refresh]);
	async function run(work: (signal: AbortSignal) => Promise<void>) {
		if (disabled || busy || operation.current) return;
		const release = acquireBookCacheMaintenance();
		if (!release) return;
		const controller = new AbortController();
		operation.current = controller;
		setBusy(true); onBusy(true); setMessage(null);
		try { await work(controller.signal); }
		catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : String(error)); }
		finally {
			operation.current = null;
			release();
			if (mounted.current) {
				setBusy(false); notifyBusy.current(false); setRefresh((value) => value + 1); onChanged();
			}
		}
	}
	async function removePages() {
		const target = confirmation;
		setConfirmation(null);
		if (target === null) return;
		await run(async (signal) => {
			const repository = await getBookCacheRepository();
			if (signal.aborted) return;
			const result = await repository.removeCachedPages(scope, target === "automatic" ? undefined : target);
			if (signal.aborted) return;
			const active = useBookDownloadProgress.getState().active;
			if (target !== "automatic" && active?.bookId === target && active.scope === scope) useBookDownloadProgress.setState({ active: null });
			setMessage(label(`${result.removed} current-cache pages removed; ${result.retained} retained. Original legacy archives, notes, drafts, chapter trees and exported files are unchanged. Protected legacy pages remain readable.`, `حذفت ${result.removed} صفحة من الذاكرة المؤقتة الحالية وأبقيت ${result.retained}. لم تتغير الأرشيفات القديمة والملاحظات والمسودات والفهارس والملفات المصدرة. تبقى الصفحات القديمة المحمية متاحة للقراءة.`));
		});
	}
	return <View className="gap-3 rounded-2xl bg-card p-4">
		<Text className="font-semibold text-foreground">{label("Recovery And Cleanup", "الاستعادة وإدارة التخزين")}</Text>
		<Text className="text-sm text-muted-foreground">{label("Restore fills missing pages only. External copies stay read-only until checked online. Cleanup keeps annotated pages and drafts; automatic cleanup also keeps pinned downloads.", "تستعيد العملية الصفحات المفقودة فقط. تبقى النسخ الخارجية للقراءة حتى التحقق عبر الإنترنت. يحتفظ التنظيف بالصفحات ذات الملاحظات والمسودات، والتنظيف التلقائي بالكتب المنزلة أيضا.")}</Text>
		{folder && <Pressable disabled={disabled || busy} onPress={() => void run(async (signal) => {
			const entries = await createAndroidBookFiles(folder).list!("");
			if (signal.aborted) return;
			const ids = entries.flatMap((name) => { const match = /^book-([1-9]\d*)$/.exec(name); const id = match ? Number(match[1]) : 0; return Number.isSafeInteger(id) && id > 0 ? [id] : []; });
			setFolderIds(ids);
			setMessage(ids.length ? label(`${ids.length} book folders found.`, `عثر على ${ids.length} مجلد كتاب.`) : label("No book folders found. Download a book and sync its files first.", "لم يعثر على مجلدات كتب. نزل كتابا ثم زامن ملفاته أولا."));
			setVisible(10);
		})} className="rounded-xl border border-border p-3"><Text className="text-primary">{label("Find Books In Folder", "البحث عن كتب في المجلد")}</Text></Pressable>}
		{folder && folderIds.slice(0, visible).map((bookId) => <Pressable key={bookId} disabled={disabled || busy} onPress={() => void run(async (signal) => {
			const result = await restoreBookFiles(createAndroidBookFiles(folder), await getBookCacheRepository(), scope, bookId, { signal, onProgress(restored, skipped, failed) { if (mounted.current) setMessage(`${restored} restored / ${skipped} already saved / ${failed} failed`); } });
			if (mounted.current) setMessage(`${result.restored} restored / ${result.skipped} already saved / ${result.failed} failed${result.cancelled ? " (paused)" : ""}${result.errors.length ? `: ${result.errors.join("; ")}` : ""}`);
		})} className="rounded-xl bg-background p-3"><Text className="text-foreground">{label(`Restore Missing Pages: Book #${bookId}`, `استعادة الصفحات المفقودة: كتاب ${bookId}`)}</Text></Pressable>)}
		{folderIds.length > visible && <Pressable onPress={() => setVisible((value) => value + 10)} className="p-2"><Text className="text-primary">{label("More Books", "المزيد من الكتب")}</Text></Pressable>}
		<Pressable disabled={disabled || busy} onPress={() => setConfirmation("automatic")} className="rounded-xl border border-border p-3"><Text className="text-foreground">{label("Clear Automatic Page Cache", "تنظيف الصفحات المخزنة تلقائيا")}</Text></Pressable>
		{books.map((book) => <Pressable key={book.id} disabled={disabled || busy} onPress={() => setConfirmation(book.id)} className="py-2"><Text className="text-sm text-muted-foreground">{label("Remove Unprotected Local Pages", "حذف الصفحات المحلية غير المحمية")}: {book.nameAr ?? book.nameEn ?? `Book #${book.id}`}</Text></Pressable>)}
		{busy && <Pressable onPress={() => operation.current?.abort()} className="p-2"><Text className="text-primary">{label("Pause Restore", "إيقاف الاستعادة")}</Text></Pressable>}
		{message && <Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">{message}</Text>}
		<FloatingBottomSheet visible={confirmation !== null} onClose={() => setConfirmation(null)} title={label("Remove Local Pages?", "حذف الصفحات المحلية؟")}>
			<View className="gap-4 px-5 pb-6">
				<Text className="text-foreground">{label("Only replaceable cached pages will be removed. Annotations, drafts, protected pages, and files in your Books folder will remain.", "ستحذف الصفحات المخزنة القابلة للاستبدال فقط. تبقى الملاحظات والمسودات والصفحات المحمية وملفات مجلد الكتب.")}</Text>
				<Pressable onPress={() => void removePages()} className="items-center rounded-xl bg-primary p-3"><Text className="font-semibold text-primary-foreground">{label("Remove Cached Pages", "حذف الصفحات المخزنة")}</Text></Pressable>
				<Pressable onPress={() => setConfirmation(null)} className="items-center p-3"><Text className="text-foreground">{label("Cancel", "إلغاء")}</Text></Pressable>
			</View>
		</FloatingBottomSheet>
	</View>;
}
