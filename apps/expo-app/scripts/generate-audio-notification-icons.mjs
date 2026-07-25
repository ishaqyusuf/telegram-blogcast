import { Buffer } from "node:buffer";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, "../assets/notification");
const SIZE = 96;

function iconSvg(body) {
	return `
		<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 96 96">
			<rect width="96" height="96" fill="none"/>
			<g fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
				${body}
			</g>
		</svg>
	`;
}

function speedSvg(label) {
	const fontSize = label.length >= 5 ? 29 : label.length >= 4 ? 34 : 42;

	return `
		<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 96 96">
			<rect width="96" height="96" fill="none"/>
			<text
				x="48"
				y="61"
				fill="#fff"
				font-family="Arial, Helvetica, sans-serif"
				font-size="${fontSize}"
				font-weight="700"
				text-anchor="middle"
			>${label}</text>
		</svg>
	`;
}

function jumpSvg(direction) {
	const isBackward = direction === "backward";
	const arrow = isBackward
		? '<path d="M31 18 16 31l15 13"/><path d="M18 31h31a29 29 0 1 1-26 42"/>'
		: '<path d="m65 18 15 13-15 13"/><path d="M78 31H47a29 29 0 1 0 26 42"/>';

	return `
		<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 96 96">
			<rect width="96" height="96" fill="none"/>
			<g fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
				${arrow}
			</g>
			<text
				x="48"
				y="67"
				fill="#fff"
				font-family="Arial, Helvetica, sans-serif"
				font-size="28"
				font-weight="700"
				text-anchor="middle"
			>15</text>
		</svg>
	`;
}

const icons = {
	"notification_comments.png": iconSvg(`
		<circle cx="48" cy="48" r="32"/>
		<path d="M48 32v32M32 48h32"/>
	`),
	"notification_jump_backward_15.png": jumpSvg("backward"),
	"notification_jump_forward_15.png": jumpSvg("forward"),
	"notification_speed_1.png": speedSvg("1×"),
	"notification_speed_1_25.png": speedSvg("1.25×"),
	"notification_speed_1_5.png": speedSvg("1.5×"),
	"notification_speed_1_75.png": speedSvg("1.75×"),
	"notification_speed_2.png": speedSvg("2×"),
};

await Promise.all(
	Object.entries(icons).map(([fileName, svg]) =>
		sharp(Buffer.from(svg)).png().toFile(path.join(OUTPUT_DIR, fileName)),
	),
);

console.log(`Generated ${Object.keys(icons).length} notification icons.`);
