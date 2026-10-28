/// <reference types="bun" />
import { afterEach, describe, expect, it } from "bun:test";
import { useGlobalAudioBarStore } from "./global-audio-bar-store";

afterEach(() => {
	useGlobalAudioBarStore.setState({ scrollHidden: false, scrollOwnerId: null });
});

describe("scroll ownership and notifications", () => {
	it("does not notify subscribers for repeated scroll visibility", () => {
		let updates = 0;
		const unsubscribe = useGlobalAudioBarStore.subscribe(() => updates++);
		try {
			const { setScrollHidden } = useGlobalAudioBarStore.getState();
			setScrollHidden(true, "feed");
			setScrollHidden(true, "feed");
			setScrollHidden(false, "feed");
			setScrollHidden(false);
			expect(updates).toBe(2);
		} finally { unsubscribe(); }
	});

	it("an outgoing surface cannot reveal a new surface's hidden player", () => {
		const { setScrollHidden } = useGlobalAudioBarStore.getState();
		setScrollHidden(true, "feed");
		setScrollHidden(true, "channel");
		const current = useGlobalAudioBarStore.getState();
		setScrollHidden(false, "feed");
		expect(useGlobalAudioBarStore.getState()).toBe(current);
		setScrollHidden(false, "channel");
		expect(useGlobalAudioBarStore.getState().scrollHidden).toBe(false);
	});
});
