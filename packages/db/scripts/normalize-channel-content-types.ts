import { inferBlogMediaContentType } from "@acme/blog";
import { db } from "../src/index";

const execute = process.argv.includes("--execute");

function inferLegacyType(blog: {
	medias: Array<{
		mimeType: string;
		title: string | null;
		file: {
			mimeType: string | null;
			fileName: string | null;
			blobContentType: string | null;
			blobPathname: string | null;
		} | null;
	}>;
}) {
	for (const media of blog.medias) {
		const type = inferBlogMediaContentType(media);
		if (type === "pdf" || type === "video") return type;
	}

	return null;
}

async function main() {
	const blogs = await db.blog.findMany({
		where: {
			type: { in: ["text", "document"] },
			telegramMessageId: { not: null },
			medias: { some: {} },
		},
		select: {
			id: true,
			medias: {
				select: {
					mimeType: true,
					title: true,
					file: {
						select: {
							mimeType: true,
							fileName: true,
							blobContentType: true,
							blobPathname: true,
						},
					},
				},
			},
		},
	});

	const candidates = blogs.flatMap((blog) => {
		const type = inferLegacyType(blog);
		return type ? [{ id: blog.id, type }] : [];
	});

	console.log(
		JSON.stringify(
			{
				mode: execute ? "execute" : "dry-run",
				candidates: candidates.length,
				pdf: candidates.filter((candidate) => candidate.type === "pdf").length,
				video: candidates.filter((candidate) => candidate.type === "video")
					.length,
				blogIds: candidates.map((candidate) => candidate.id),
			},
			null,
			2,
		),
	);

	if (!execute) {
		console.log(
			"Dry run only. Re-run with --execute to normalize these blog types.",
		);
		return;
	}

	for (const candidate of candidates) {
		await db.blog.update({
			where: { id: candidate.id },
			data: { type: candidate.type },
		});
	}

	console.log(`Normalized ${candidates.length} Telegram blog types.`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.$disconnect();
	});
