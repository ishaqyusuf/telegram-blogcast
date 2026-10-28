// Run against an already-open app. Never clears data, deletes posts, or changes settings.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [serial, mode = "frames", output = "/tmp/al-ghurobaa-scroll-check"] = process.argv.slice(2);
if (!serial || !["frames", "expanded-row", "books-viewport"].includes(mode)) {
	throw new Error("Usage: node scripts/android-scroll-check.mjs SERIAL [frames|expanded-row|books-viewport] [OUTPUT_DIR]");
}
const appId = process.env.ANDROID_SCROLL_APP_ID ?? "com.alghurobaa.podcast.dev";
if (!/^com\.alghurobaa\.podcast(?:\.[a-z][a-z0-9]*)*$/.test(appId)) {
	throw new Error("ANDROID_SCROLL_APP_ID must identify an Al-Ghurobaa app");
}
const adb = (...args) => execFileSync("adb", ["-s", serial, ...args], { timeout: 15_000 });
const text = (...args) => adb(...args).toString();
const assertForeground = () => {
	const focus = text("shell", "dumpsys", "window").split("\n").find((line) => line.includes("mCurrentFocus"));
	const focusedApp = focus?.match(/\bu\d+\s+([^/\s]+)\//)?.[1];
	if (focusedApp !== appId) throw new Error(`Expected ${appId} in foreground; stopping without further input.`);
};
const dir = resolve(output);
mkdirSync(dir, { recursive: true });
assertForeground();
const size = [...text("shell", "wm", "size").matchAll(/(?:Physical|Override) size: (\d+)x(\d+)/g)].at(-1);
if (!size) throw new Error("Could not read display size");
const [, width, height] = size.map(Number);
const screenshot = (name) => writeFileSync(resolve(dir, `${name}.png`), adb("exec-out", "screencap", "-p"));
const readNodes = () => {
	text("shell", "uiautomator", "dump", "/sdcard/al-ghurobaa-scroll-check.xml");
	const xml = text("shell", "cat", "/sdcard/al-ghurobaa-scroll-check.xml");
	const nodes = [], stack = [];
	for (const [tag] of xml.matchAll(/<node\b[^>]*>|<\/node>/g)) {
		if (tag === "</node>") { stack.pop(); continue; }
		const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
		const bounds = attrs.bounds?.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
		const node = { ...attrs, rect: bounds ? bounds.slice(1).map(Number) : null, parent: stack.at(-1) };
		nodes.push(node);
		if (!tag.endsWith("/>")) stack.push(node);
	}
	return nodes;
};
const cardFor = (node) => {
	for (let parent = node.parent; parent; parent = parent.parent) {
		if (parent.clickable === "true" && parent.class === "android.view.ViewGroup") return parent;
	}
};
const playControl = (nodes, row) => nodes.find((node) => {
	if (!["Play audio", "Pause audio"].includes(node["content-desc"])) return false;
	for (let parent = node.parent; parent; parent = parent.parent) if (parent === row) return true;
	return false;
});

if (mode === "books-viewport") {
	const nodes = readNodes();
	if (!nodes.some((node) => ["Digital Books", "الكتب الرقمية"].includes(node.text))) {
		throw new Error("Open Digital Books before repeating the viewport check");
	}
	const visible = (node) => node.rect && node.rect[3] > node.rect[1];
	const heading = nodes.find((node) => visible(node) && ["Explore books", "استكشف الكتب"].includes(node.text))
		?? nodes.find((node) => visible(node) && ["Keep reading", "متابعة القراءة"].includes(node.text));
	if (!heading) throw new Error("Show the Digital Books header before repeating the viewport check");
	let scroll;
	for (let parent = heading.parent; parent; parent = parent.parent) {
		if (parent.class === "android.widget.ScrollView" && parent.scrollable === "true") { scroll = parent; break; }
	}
	screenshot("before");
	const fullViewport = Boolean(scroll?.rect && scroll.rect[1] < height * 0.2);
	let afterTop = heading.rect?.[1];
	if (fullViewport) {
		assertForeground();
		text("shell", "input", "swipe", String(Math.round(width * 0.5)), String(Math.round(height * 0.36)), String(Math.round(width * 0.5)), String(Math.round(height * 0.18)), "600");
		const afterNodes = readNodes();
		if (!afterNodes.some((node) => ["Digital Books", "الكتب الرقمية"].includes(node.text))) {
			throw new Error("The gesture left Digital Books instead of scrolling its body");
		}
		const after = afterNodes.find((node) => node.text === heading.text);
		afterTop = after?.rect?.[1] ?? 0;
		screenshot("after");
	}
	const beforeTop = heading.rect?.[1] ?? 0;
	const passed = fullViewport && beforeTop - afterTop > 20;
	const result = { mode, serial, scrollTop: scroll?.rect?.[1] ?? null, screenHeight: height, beforeTop, afterTop, passed };
	writeFileSync(resolve(dir, "result.json"), JSON.stringify(result, null, 2));
	console.log(result);
	if (!passed) process.exitCode = 1;
} else if (mode === "expanded-row") {
	const nodes = readNodes();
	const more = nodes.find((node) => node.text === "Read more" && node.rect && node.rect[1] > 150 && node.rect[3] < height - 400 && playControl(nodes, cardFor(node)));
	if (!more) throw new Error("Place a collapsed audio post's Read more control in the middle of the screen, then repeat.");
	const rowDescription = cardFor(more)["content-desc"];
	screenshot("collapsed");
	assertForeground();
	const [left, top, right, bottom] = more.rect;
	text("shell", "input", "tap", String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2)));
	const expanded = readNodes();
	const disclosure = expanded.find((node) => node.text === "Show less" && cardFor(node)?.["content-desc"] === rowDescription);
	if (!disclosure) throw new Error("Read more did not expand");
	const row = cardFor(disclosure);
	if (!row) throw new Error("Could not identify the expanded card's native container");
	const play = playControl(expanded, row);
	if (!play && row.rect?.[3] >= height - 40) throw new Error("Expanded row runs beyond the viewport; choose a shorter post or move it higher.");
	const density = Number([...text("shell", "wm", "density").matchAll(/(?:Physical|Override) density: (\d+)/g)].at(-1)?.[1]);
	if (!density) throw new Error("Could not read display density");
	// A fully clipped control is absent from the tree: never accept a later row's button.
	const controlHeight = play?.rect ? play.rect[3] - play.rect[1] : 0;
	const minimum = Math.floor(44 * density / 160);
	const contentGutter = disclosure.rect[0] - row.rect[0];
	screenshot("expanded");
	const result = { mode, serial, controlHeight, minimum, contentGutter, passed: controlHeight >= minimum && contentGutter > 0 };
	writeFileSync(resolve(dir, "result.json"), JSON.stringify(result, null, 2));
	console.log(result);
	if (!result.passed) process.exitCode = 1;
} else {
	text("shell", "dumpsys", "gfxinfo", appId, "reset");
	const x = String(Math.round(width / 2));
	for (const [start, end] of [[0.77, 0.28], [0.77, 0.28], [0.28, 0.77], [0.28, 0.77]]) {
		assertForeground();
		text("shell", "input", "swipe", x, String(Math.round(height * start)), x, String(Math.round(height * end)), "400");
	}
	assertForeground();
	const gfx = text("shell", "dumpsys", "gfxinfo", appId);
	if (!Number(gfx.match(/Total frames rendered: (\d+)/)?.[1])) throw new Error("No rendered frames; this is not a valid scroll measurement.");
	writeFileSync(resolve(dir, "frames.txt"), gfx);
	writeFileSync(resolve(dir, "framestats.txt"), text("shell", "dumpsys", "gfxinfo", appId, "framestats"));
	screenshot("settled");
	console.log(gfx.split("\n").filter((line) => /Total frames rendered:|Janky frames:|percentile:/.test(line)).join("\n"));
	console.log("Timing evidence only. Inspect settled/moving text and compare the same route, data, build and device.");
}
