import { expect, test } from "bun:test";
import type { Database } from "@acme/db";
import { MOBILE_BUILD_SCOPE } from "@acme/utils/mobile-build";
import {
	publishMobileBuild,
	readMobileBuild,
	withdrawMobileBuild,
} from "./mobile-build";

// Explicit opt-in, before first live registration; all writes roll back together.
test.skipIf(process.env.MOBILE_BUILD_DB_TEST !== "1")(
	"registry serialization, CAS, idempotency and withdrawal",
	async () => {
		const { db } = await import("@acme/db");
		const rollback = new Error("ROLLBACK_MOBILE_BUILD_TEST");
		const fixture = {
			...MOBILE_BUILD_SCOPE,
			buildId: "a86d38dd-cbd3-4187-a15f-63ffd70f3f58",
			buildNumber: 28,
			appVersion: "1.0.112",
			runtimeVersion: "1.0.112",
			gitCommit: "a".repeat(40),
			artifactUrl: "https://expo.dev/artifacts/eas/example.apk",
			sha256: "b".repeat(64),
			sizeBytes: 1234,
			expiresAt: "2099-11-20T05:27:42.797Z",
			notes: "Test — must roll back",
		};
		try {
			expect(await readMobileBuild(db)).toBeNull();
			await expect(
				db.$transaction(
					async (tx) => {
						const scoped = {
							...tx,
							$transaction: (work: (client: typeof tx) => Promise<unknown>) =>
								work(tx),
						} as unknown as Database;
						const first = await publishMobileBuild(scoped, fixture, 0);
						expect(first.revision).toBe(1);
						expect(await publishMobileBuild(scoped, fixture, 0)).toEqual(first);
						await expect(
							publishMobileBuild(scoped, { ...fixture, buildNumber: 29 }, 0),
						).rejects.toThrow("changed");
						await expect(
							publishMobileBuild(scoped, { ...fixture, buildNumber: 27 }, 1),
						).rejects.toThrow("higher");
						const next = await publishMobileBuild(
							scoped,
							{ ...fixture, buildNumber: 29 },
							1,
						);
						expect(next.revision).toBe(2);
						expect((await readMobileBuild(scoped))?.buildNumber).toBe(29);
						expect((await withdrawMobileBuild(scoped, 2)).active).toBe(false);
						await expect(withdrawMobileBuild(scoped, 2)).rejects.toThrow(
							"changed",
						);
						throw rollback;
					},
					{ timeout: 30_000 },
				),
			).rejects.toBe(rollback);
			expect(await readMobileBuild(db)).toBeNull();
		} finally {
			await db.$disconnect();
		}
	},
);
