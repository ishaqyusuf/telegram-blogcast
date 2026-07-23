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

const icons = {
	"notification_comments.png": iconSvg(`
		<path d="M22 20h52a10 10 0 0 1 10 10v30a10 10 0 0 1-10 10H48L30 84V70h-8A10 10 0 0 1 12 60V30a10 10 0 0 1 10-10Z"/>
		<path d="M48 35v20M38 45h20"/>
	`),
	"notification_jump_backward_5.png": iconSvg(`
		<path d="M29 24 14 37l15 13"/>
		<path d="M17 37h34a25 25 0 1 1-23 35"/>
		<path d="M58 38H43l-2 13h12a10 10 0 0 1 0 20H40"/>
	`),
	"notification_jump_forward_5.png": iconSvg(`
		<path d="m67 24 15 13-15 13"/>
		<path d="M79 37H45a25 25 0 1 0 23 35"/>
		<path d="M38 38H23l-2 13h12a10 10 0 0 1 0 20H20"/>
	`),
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
