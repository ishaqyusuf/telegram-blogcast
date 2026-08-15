import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, "karaoke-transcript.tsx"), "utf8");
const audioScreenSource = readFileSync(
	join(currentDir, "../../screens/audio-blog-screen.tsx"),
	"utf8",
);

describe("karaoke transcript scrolling", () => {
	test("uses the shared inline transcript surface in karaoke mode", () => {
		expect(source).toContain("<SelectableTranscriptSurface");
		expect(source).toContain('presentation="karaoke"');
		expect(source).toContain("selectionEnabled={false}");
		expect(source).not.toContain("LegendList");
	});

	test("keeps the bounded player viewport and a live catch-up control", () => {
		expect(source).toContain("Return to live transcript position");
		expect(source).toContain("setFollowPaused(false)");
		expect(audioScreenSource).toMatch(
			/<FlatList\s+ref=\{mainScroll\.ref\}[\s\S]*?nestedScrollEnabled/,
		);
	});

	test("uses real audio controls and inset-safe read-mode chrome", () => {
		expect(audioScreenSource).toContain('edges={["top", "bottom"]}');
		expect(audioScreenSource).toContain("statusBarTranslucent");
		expect(audioScreenSource).toContain(
			"onPress={() => void handleViewedPlayPause()}",
		);
		expect(audioScreenSource).toContain(
			"disabled={playerIsLoading && !playerIsPlaying}",
		);
		expect(audioScreenSource).toContain('"Pause audio" : "Play audio"');
		expect(audioScreenSource).not.toContain("Pause read highlight");
		expect(audioScreenSource).not.toContain("gotoCurrentTranscriptPosition");
	});
});
