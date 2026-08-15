import { beforeEach, describe, expect, test } from "bun:test";

import { useFloatingBottomSheetStore } from "./floating-bottom-sheet-store";

describe("floating bottom sheet registry", () => {
	beforeEach(() => {
		useFloatingBottomSheetStore.setState({ openSheetIds: {} });
	});

	test("stays active until every open floating sheet dismisses", () => {
		const store = useFloatingBottomSheetStore.getState();

		store.setSheetOpen("queue-options", true);
		store.setSheetOpen("local-services", true);
		expect(
			Object.keys(useFloatingBottomSheetStore.getState().openSheetIds),
		).toEqual(["queue-options", "local-services"]);

		store.setSheetOpen("queue-options", false);
		expect(
			Object.keys(useFloatingBottomSheetStore.getState().openSheetIds),
		).toEqual(["local-services"]);

		store.setSheetOpen("local-services", false);
		expect(useFloatingBottomSheetStore.getState().openSheetIds).toEqual({});
	});

	test("registering the same sheet repeatedly is idempotent", () => {
		const store = useFloatingBottomSheetStore.getState();

		store.setSheetOpen("audio-options", true);
		store.setSheetOpen("audio-options", true);

		expect(
			Object.keys(useFloatingBottomSheetStore.getState().openSheetIds),
		).toEqual(["audio-options"]);
	});
});
