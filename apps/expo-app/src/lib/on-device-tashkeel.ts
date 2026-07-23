import { NativeModules, Platform } from "react-native";

export async function diacritizeTextOnDevice(source: string) {
	if (Platform.OS === "web") return source;

	if (NativeModules.Onnxruntime == null) {
		throw new Error("Install the latest app build to use Arabic vowels.");
	}

	const nativeRuntime = require("./on-device-tashkeel-runtime") as {
		diacritizeTextOnDevice: (text: string) => Promise<string>;
	};
	return nativeRuntime.diacritizeTextOnDevice(source);
}
