const { withMainApplication } = require("@expo/config-plugins");

function addOnnxruntimePackage(source) {
	let contents = source;

	if (
		!contents.includes("import ai.onnxruntime.reactnative.OnnxruntimePackage")
	) {
		const withImport = contents.replace(
			"import com.facebook.react.ReactPackage\n",
			"import com.facebook.react.ReactPackage\nimport ai.onnxruntime.reactnative.OnnxruntimePackage\n",
		);
		if (withImport === contents) {
			throw new Error(
				"Unable to register ONNX Runtime: ReactPackage import anchor was not found.",
			);
		}
		contents = withImport;
	}

	if (!contents.includes("add(OnnxruntimePackage())")) {
		if (contents.includes("add(ImageClipboardPackage())")) {
			contents = contents.replace(
				"add(ImageClipboardPackage())",
				"add(ImageClipboardPackage())\n              add(OnnxruntimePackage())",
			);
		} else {
			contents = contents.replace(
				"// add(MyReactNativePackage())",
				"add(OnnxruntimePackage())",
			);
		}
		if (!contents.includes("add(OnnxruntimePackage())")) {
			throw new Error(
				"Unable to register ONNX Runtime: package-list anchor was not found.",
			);
		}
	}

	return contents;
}

function withOnnxruntimePackage(config) {
	return withMainApplication(config, (modConfig) => {
		modConfig.modResults.contents = addOnnxruntimePackage(
			modConfig.modResults.contents,
		);
		return modConfig;
	});
}

module.exports = withOnnxruntimePackage;
module.exports.addOnnxruntimePackage = addOnnxruntimePackage;
