import { Pressable } from "@/components/ui/pressable";
import { useTranslation } from "@/lib/i18n";
import { Image, Text, View } from "react-native";

type BookDetailHeroProps = {
	book: {
		nameAr: string | null;
		nameEn: string | null;
		coverUrl: string | null;
		coverColor: string | null;
		authors: { nameAr: string | null; name: string }[];
	};
	fetchedCount: number;
	knownCount: number;
	volumeCount: number;
	continuePageNo: number | null;
	onEditCover: () => void;
};

export function BookDetailHero({
	book,
	fetchedCount,
	knownCount,
	volumeCount,
	continuePageNo,
	onEditCover,
}: BookDetailHeroProps) {
	const { isRtl } = useTranslation();
	const title = book.nameAr ?? book.nameEn ?? (isRtl ? "كتاب" : "Book");
	const authors = book.authors
		.map((author) => author.nameAr ?? author.name)
		.join("، ");
	return (
		<View
			style={{
				backgroundColor: "#12392F",
				alignItems: "center",
				paddingHorizontal: 24,
				paddingTop: 26,
				paddingBottom: 24,
				marginBottom: 16,
			}}
		>
			<Pressable
				onPress={onEditCover}
				accessibilityRole="button"
				accessibilityLabel={isRtl ? "تغيير غلاف الكتاب" : "Change book cover"}
				style={{
					width: 148,
					height: 205,
					borderRadius: 10,
					overflow: "hidden",
					backgroundColor: book.coverColor ?? "#226455",
					alignItems: "center",
					justifyContent: "center",
					elevation: 8,
				}}
			>
				{book.coverUrl ? (
					<Image
						source={{ uri: book.coverUrl }}
						style={{ width: "100%", height: "100%" }}
						resizeMode="cover"
					/>
				) : (
					<>
						<Text style={{ color: "#D9C48A", fontSize: 29, marginBottom: 10 }}>
							۞
						</Text>
						<Text
							numberOfLines={4}
							style={{
								color: "#F5E9CB",
								fontFamily: "serif",
								fontSize: 19,
								lineHeight: 31,
								textAlign: "center",
								writingDirection: "rtl",
								fontWeight: "700",
								paddingHorizontal: 12,
							}}
						>
							{title}
						</Text>
					</>
				)}
			</Pressable>
			<Text
				style={{
					color: "#F7F6EE",
					fontSize: 22,
					lineHeight: 32,
					textAlign: "center",
					writingDirection: book.nameAr ? "rtl" : "ltr",
					fontWeight: "700",
					marginTop: 19,
				}}
			>
				{title}
			</Text>
			{authors ? (
				<Text
					style={{
						color: "#D1DFD3",
						fontSize: 13,
						textAlign: "center",
						writingDirection: "rtl",
						marginTop: 5,
					}}
				>
					{authors}
				</Text>
			) : null}
			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					justifyContent: "center",
					gap: 7,
					marginTop: 16,
				}}
			>
				{continuePageNo != null ? (
					<Text
						style={{
							color: "#E8F4E9",
							backgroundColor: "#315C50",
							borderRadius: 999,
							paddingHorizontal: 11,
							paddingVertical: 6,
							fontSize: 11,
						}}
					>
						{isRtl ? `صفحة ${continuePageNo}` : `Page ${continuePageNo}`}
					</Text>
				) : null}
				<Text
					style={{
						color: "#E8F4E9",
						backgroundColor: "#315C50",
						borderRadius: 999,
						paddingHorizontal: 11,
						paddingVertical: 6,
						fontSize: 11,
					}}
				>
					{isRtl
						? `${fetchedCount} محفوظة على الخادم`
						: `${fetchedCount} server pages`}
				</Text>
				{volumeCount > 0 ? (
					<Text
						style={{
							color: "#E8F4E9",
							backgroundColor: "#315C50",
							borderRadius: 999,
							paddingHorizontal: 11,
							paddingVertical: 6,
							fontSize: 11,
						}}
					>
						{isRtl ? `${volumeCount} مجلدات` : `${volumeCount} volumes`}
					</Text>
				) : null}
			</View>
			<Pressable
				onPress={onEditCover}
				accessibilityRole="button"
				style={{ marginTop: 17, padding: 7 }}
			>
				<Text style={{ color: "#C9E7D1", fontSize: 12, fontWeight: "600" }}>
					{book.coverUrl
						? isRtl
							? "تغيير الغلاف"
							: "Change cover"
						: isRtl
							? "إضافة غلاف من رابط"
							: "Add cover from link"}
				</Text>
			</Pressable>
			{knownCount > fetchedCount ? (
				<Text style={{ color: "#ADCCBD", fontSize: 11, textAlign: "center" }}>
					{isRtl
						? `${knownCount - fetchedCount} صفحة معروفة تنتظر الحفظ`
						: `${knownCount - fetchedCount} known pages await capture`}
				</Text>
			) : null}
		</View>
	);
}
