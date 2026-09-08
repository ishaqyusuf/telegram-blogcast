import { useRef, useState } from "react";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { FloatingBottomSheet } from "@/components/ui/floating-bottom-sheet";

export function BookReaderMenu({
	bookId,
	onFootnotes,
}: { bookId: number; onFootnotes: () => void }) {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const pendingAction = useRef<(() => void) | null>(null);
	return (
		<>
			<Pressable
				accessibilityLabel="Reader menu"
				accessibilityRole="button"
				onPress={() => setOpen(true)}
				className="size-[34px] items-center justify-center rounded-full bg-card"
			>
				<Icon name="MoreHorizontal" size={20} className="text-foreground" />
			</Pressable>
			<FloatingBottomSheet
				visible={open}
				onClose={() => setOpen(false)}
				title="Reader menu"
				onDismissed={() => {
					const action = pendingAction.current;
					pendingAction.current = null;
					action?.();
				}}
			>
				{(["Highlights", "Bookmarks", "Footnotes"] as const).map((label) => (
					<Pressable
						key={label}
						accessibilityRole="button"
						onPress={() => {
							setOpen(false);
							pendingAction.current = () => {
								if (label === "Footnotes") onFootnotes();
								else
									router.push({
										pathname: "/books/[bookId]/saved",
										params: { bookId, kind: label.toLowerCase() },
									} as any);
							};
						}}
						className="min-h-12 justify-center rounded-xl px-4 py-3"
					>
						<Text className="text-base font-medium text-foreground">
							{label}
						</Text>
					</Pressable>
				))}
				<Pressable
					onPress={() => setOpen(false)}
					className="min-h-12 justify-center px-4 py-3"
				>
					<Text className="text-base text-muted-foreground">Cancel</Text>
				</Pressable>
			</FloatingBottomSheet>
		</>
	);
}
