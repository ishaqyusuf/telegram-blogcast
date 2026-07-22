import { describe, expect, test } from "bun:test";

const layoutSource = await Bun.file(`${import.meta.dir}/_layout.tsx`).text();

describe("root query provider boundary", () => {
	test("keeps the bottom-sheet portal host inside the React Query provider", () => {
		const rootNav = layoutSource.slice(
			layoutSource.indexOf("function RootLayoutNav"),
		);
		const queryProviderOpen = rootNav.indexOf("<TRPCReactProvider>");
		const bottomSheetProvider = rootNav.indexOf("<BottomSheetModalProvider>");
		const queryProviderClose = rootNav.indexOf("</TRPCReactProvider>");

		expect(queryProviderOpen).toBeGreaterThanOrEqual(0);
		expect(bottomSheetProvider).toBeGreaterThan(queryProviderOpen);
		expect(queryProviderClose).toBeGreaterThan(bottomSheetProvider);
	});
});
