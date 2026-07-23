import { expect, test } from "bun:test";
import registrationModule from "./register-playback-service";

const { registerAndroidPlaybackService } = registrationModule as {
	registerAndroidPlaybackService: (input: {
		platform: string;
		register: (factory: () => unknown) => void;
		serviceFactory: () => unknown;
	}) => boolean;
};

test("registers the Android playback service exactly once", () => {
	const registrations: (() => unknown)[] = [];
	const serviceFactory = () => "playback-service";

	expect(
		registerAndroidPlaybackService({
			platform: "ios",
			register: (factory) => registrations.push(factory),
			serviceFactory,
		}),
	).toBe(false);
	expect(
		registerAndroidPlaybackService({
			platform: "android",
			register: (factory) => registrations.push(factory),
			serviceFactory,
		}),
	).toBe(true);
	expect(
		registerAndroidPlaybackService({
			platform: "android",
			register: (factory) => registrations.push(factory),
			serviceFactory,
		}),
	).toBe(false);
	expect(registrations).toEqual([serviceFactory]);
});
