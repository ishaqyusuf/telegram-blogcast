const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const ANDROID_NOTIFICATION_ICON_FILES = [
	"notification_comments.png",
	"notification_jump_backward_5.png",
	"notification_jump_forward_5.png",
	"notification_speed_1.png",
	"notification_speed_1_25.png",
	"notification_speed_1_5.png",
	"notification_speed_1_75.png",
	"notification_speed_2.png",
];

function copyAudioNotificationIcons(androidProjectRoot) {
	const pluginRoot = path.dirname(
		require.resolve("./with-audio-notification-icons.js"),
	);
	const sourceRoot = path.resolve(pluginRoot, "../assets/notification");
	const targetRoot = path.join(androidProjectRoot, "app/src/main/res/drawable");

	fs.mkdirSync(targetRoot, { recursive: true });
	for (const fileName of ANDROID_NOTIFICATION_ICON_FILES) {
		fs.copyFileSync(
			path.join(sourceRoot, fileName),
			path.join(targetRoot, fileName),
		);
	}
}

function withAudioNotificationIcons(config) {
	return withDangerousMod(config, [
		"android",
		(modConfig) => {
			copyAudioNotificationIcons(modConfig.modRequest.platformProjectRoot);
			return modConfig;
		},
	]);
}

module.exports = withAudioNotificationIcons;
module.exports.ANDROID_NOTIFICATION_ICON_FILES =
	ANDROID_NOTIFICATION_ICON_FILES;
module.exports.copyAudioNotificationIcons = copyAudioNotificationIcons;
