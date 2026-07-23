import { Platform } from "react-native";

export async function diacritizeTextOnDevice(source: string) {
	if (Platform.OS === "web") return source;

	const nativeRuntime = require("./on-device-tashkeel.native") as {
		diacritizeTextOnDevice: (text: string) => Promise<string>;
	};
	return nativeRuntime.diacritizeTextOnDevice(source);
}
