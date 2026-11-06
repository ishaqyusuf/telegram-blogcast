import type { Database } from "@acme/db";
import {
	MOBILE_BUILD_KEY,
	type MobileBuild,
	parseMobileBuild,
	parsePublishedMobileBuild,
} from "@acme/utils/mobile-build";

export async function readMobileBuild(db: Database) {
	const row = await db.mobileBuildRelease.findUnique({
		where: { key: MOBILE_BUILD_KEY },
	});
	return row
		? parsePublishedMobileBuild({
				...parsePublishedMobileBuild(row.value),
				revision: row.revision,
			})
		: null;
}

/** CLI-only write: serialized, monotonic and idempotent. No public mutation route. */
export async function publishMobileBuild(
	db: Database,
	input: MobileBuild,
	expectedRevision: number,
) {
	const build = parseMobileBuild(input);
	if (Date.parse(build.expiresAt) <= Date.now())
		throw new Error("Cannot publish an expired APK");
	return db.$transaction(
		async (tx) => {
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${MOBILE_BUILD_KEY}))`;
			const row = await tx.mobileBuildRelease.findUnique({
				where: { key: MOBILE_BUILD_KEY },
			});
			const current = row ? parsePublishedMobileBuild(row.value) : null;
			if (
				current?.active &&
				JSON.stringify(parseMobileBuild(current)) === JSON.stringify(build)
			)
				return current;
			if ((row?.revision ?? 0) !== expectedRevision)
				throw new Error("Build registry changed; read status and retry");
			if (current && build.buildNumber <= current.buildNumber)
				throw new Error("Publish a higher native build number");
			const value = {
				...build,
				active: true,
				revision: (row?.revision ?? 0) + 1,
				publishedAt: new Date().toISOString(),
			};
			await tx.mobileBuildRelease.upsert({
				where: { key: MOBILE_BUILD_KEY },
				create: { key: MOBILE_BUILD_KEY, value, revision: value.revision },
				update: { value, revision: value.revision },
			});
			return value;
		},
		{ maxWait: 10_000, timeout: 30_000 },
	);
}

export async function withdrawMobileBuild(
	db: Database,
	expectedRevision: number,
) {
	return db.$transaction(
		async (tx) => {
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${MOBILE_BUILD_KEY}))`;
			const row = await tx.mobileBuildRelease.findUnique({
				where: { key: MOBILE_BUILD_KEY },
			});
			if (!row || row.revision !== expectedRevision)
				throw new Error("Build registry changed; read status and retry");
			const current = parsePublishedMobileBuild(row.value);
			if (!current.active) return current;
			const value = { ...current, active: false, revision: row.revision + 1 };
			await tx.mobileBuildRelease.update({
				where: { key: MOBILE_BUILD_KEY },
				data: { value, revision: value.revision },
			});
			return value;
		},
		{ maxWait: 10_000, timeout: 30_000 },
	);
}
