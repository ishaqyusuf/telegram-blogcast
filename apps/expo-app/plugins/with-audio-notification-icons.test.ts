import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import pluginModule from "./with-audio-notification-icons";

const { ANDROID_NOTIFICATION_ICON_FILES, copyAudioNotificationIcons } =
	pluginModule as {
		ANDROID_NOTIFICATION_ICON_FILES: string[];
		copyAudioNotificationIcons: (androidProjectRoot: string) => void;
	};

test("installs every notification icon as a stable Android drawable", () => {
	const projectRoot = mkdtempSync(
		path.join(tmpdir(), "audio-notification-icons-"),
	);

	try {
		copyAudioNotificationIcons(projectRoot);

		expect(ANDROID_NOTIFICATION_ICON_FILES).toEqual([
			"notification_comments.png",
			"notification_jump_backward_5.png",
			"notification_jump_forward_5.png",
			"notification_speed_1.png",
			"notification_speed_1_25.png",
			"notification_speed_1_5.png",
			"notification_speed_1_75.png",
			"notification_speed_2.png",
		]);
		for (const fileName of ANDROID_NOTIFICATION_ICON_FILES) {
			expect(
				existsSync(
					path.join(projectRoot, "app/src/main/res/drawable", fileName),
				),
			).toBe(true);
		}
	} finally {
		rmSync(projectRoot, { recursive: true });
	}
});
