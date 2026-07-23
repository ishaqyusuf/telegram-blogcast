import { describe, expect, mock, test } from "bun:test";

mock.module("react-native", () => ({
	NativeModules: {
		Onnxruntime: null,
	},
	Platform: {
		OS: "android",
	},
}));

const { diacritizeTextOnDevice } = await import("./on-device-tashkeel");

describe("on-device tashkeel native runtime compatibility", () => {
	test("does not load ONNX when the installed binary lacks its native module", async () => {
		await expect(diacritizeTextOnDevice("طلب العلم")).rejects.toThrow(
			"Install the latest app build to use Arabic vowels.",
		);
	});
});
