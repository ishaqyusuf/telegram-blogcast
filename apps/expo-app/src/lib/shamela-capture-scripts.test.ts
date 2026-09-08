import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { buildShamelaCaptureScript } from "./shamela-capture-scripts";

function fixture() {
	let clock = 0;
	let poll: (() => void) | undefined;
	let mutate: (() => void) | undefined;
	const messages: any[] = [];
	const state = { text: "", html: "", challenge: false, pageId: "110" };
	const document = {
		title: "Book",
		readyState: "complete",
		documentElement: { outerHTML: "<html>source</html>" },
		querySelector: (selector: string) =>
			selector === ".nass"
				? {
						textContent: state.text,
						innerHTML: state.html,
						getAttribute: () => state.pageId,
					}
				: state.challenge
					? {}
					: null,
	};
	const context = {
		document,
		URL,
		location: { href: "https://shamela.ws/book/23833/110" },
		window: {
			ReactNativeWebView: {
				postMessage: (value: string) => messages.push(JSON.parse(value)),
			},
		},
		Date: { now: () => clock },
		setInterval: (fn: () => void) => {
			poll = fn;
			return 1;
		},
		clearInterval: () => {
			poll = undefined;
		},
		MutationObserver: class {
			constructor(fn: () => void) {
				mutate = fn;
			}
			observe() {}
			disconnect() {
				mutate = undefined;
			}
		},
	};
	const install = () =>
		runInNewContext(
			buildShamelaCaptureScript(1, context.location.href),
			context,
		);
	install();
	return {
		state,
		messages,
		context,
		install,
		advance: (ms = 800) => {
			clock += ms;
			poll?.();
		},
		change: () => mutate?.(),
	};
}

test("late DOM content automatically captures only after stability", () => {
	const f = fixture();
	f.advance();
	expect(f.messages).toHaveLength(0);
	f.state.text = "Arabic book content";
	f.state.html = "<p>Arabic book content</p>";
	f.change();
	f.advance(400);
	expect(f.messages).toHaveLength(0);
	f.advance(400);
	f.advance();
	expect(f.messages).toHaveLength(1);
	expect(f.messages[0]).toMatchObject({ type: "capture", requestId: 1 });
});

test("CAPTCHA reveals once, then captures automatically after solving in the same document", () => {
	const f = fixture();
	f.state.challenge = true;
	f.change();
	f.advance();
	expect(f.messages.map((message) => message.type)).toEqual(["verification"]);
	f.state.challenge = false;
	f.state.text = "Readable";
	f.state.html = "<p>Readable</p>";
	f.change();
	f.advance();
	expect(f.messages.map((message) => message.type)).toEqual([
		"verification",
		"capture",
	]);
});

test("inline markup changes reset readiness and duplicate installation is harmless", () => {
	const f = fixture();
	f.state.text = "Readable";
	f.state.html = "<p>Readable</p>";
	f.change();
	f.advance(400);
	f.state.html = "<p><b>Readable</b></p>";
	f.change();
	f.install();
	f.advance(400);
	expect(f.messages).toHaveLength(0);
	f.advance(400);
	expect(f.messages).toHaveLength(1);
});

test("mismatched source page metadata cannot be captured", () => {
	const f = fixture();
	f.state.text = "Wrong page";
	f.state.html = "<p>Wrong page</p>";
	f.state.pageId = "111";
	f.change();
	f.advance();
	f.advance();
	expect(f.messages).toHaveLength(0);
});

test("Arabic source page digits match the canonical page identity", () => {
	const f = fixture();
	f.state.text = "Readable";
	f.state.html = "<p>Readable</p>";
	f.state.pageId = "١١٠";
	f.change();
	f.advance();
	expect(f.messages[0]?.type).toBe("capture");
});
