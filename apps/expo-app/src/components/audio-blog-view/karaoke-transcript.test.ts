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
	test("does not mount a React Native VirtualizedList inside the player list", () => {
		expect(source).toContain('from "@legendapp/list"');
		expect(source).not.toMatch(
			/import\s*\{[^}]*\bFlatList\b[^}]*\}\s*from\s*"react-native"/s,
		);
	});

	test("keeps nested native scrolling enabled for the bounded transcript viewport", () => {
		expect(source).toContain("nestedScrollEnabled");
		expect(source).toContain("scrollToIndex");
		expect(audioScreenSource).toMatch(
			/<FlatList\s+ref=\{mainScroll\.ref\}[\s\S]*?nestedScrollEnabled/,
		);
	});
});
