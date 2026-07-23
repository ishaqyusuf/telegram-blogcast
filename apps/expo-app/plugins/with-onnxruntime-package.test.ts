import { describe, expect, test } from "bun:test";

const { addOnnxruntimePackage } = require("./with-onnxruntime-package.js") as {
	addOnnxruntimePackage: (source: string) => string;
};

describe("with-onnxruntime-package", () => {
	test("registers the legacy React package exactly once", () => {
		const source = `import com.facebook.react.ReactPackage
import com.alghurobaa.podcast.clipboard.ImageClipboardPackage

add(ImageClipboardPackage())`;

		const once = addOnnxruntimePackage(source);
		const twice = addOnnxruntimePackage(once);

		expect(once).toContain(
			"import ai.onnxruntime.reactnative.OnnxruntimePackage",
		);
		expect(once).toContain("add(OnnxruntimePackage())");
		expect(twice).toBe(once);
	});

	test("fails prebuild when Expo's package-list anchors change", () => {
		expect(() =>
			addOnnxruntimePackage(
				"import com.facebook.react.ReactPackage\n\nreturn packages",
			),
		).toThrow("package-list anchor was not found");
	});

	test("fails prebuild when Expo's import anchor changes", () => {
		expect(() => addOnnxruntimePackage("return packages")).toThrow(
			"ReactPackage import anchor was not found",
		);
	});
});
