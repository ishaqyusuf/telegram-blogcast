import { describe, expect, test } from "bun:test";
import type { Database } from "@acme/db";

import {
	LOCAL_SERVICE_JOB_LEASE_MS,
	claimLocalServiceJob,
	createLocalServiceJob,
	finishLocalServiceJob,
} from "./local-service-job-store";

function createClaimDb(job: {
	id: string;
	status: string;
	runnerId: string | null;
	heartbeatAt: Date | null;
}) {
	type ClaimArgs = {
		where: {
			id: string;
			status: string;
			OR: Array<{
				runnerId?: string;
				heartbeatAt?: null | { lt: Date };
			}>;
		};
		data: { runnerId: string; heartbeatAt: Date };
	};
	return {
		localServiceJob: {
			updateMany: async ({ where, data }: ClaimArgs) => {
				const staleBefore = where.OR.find(
					(entry) => entry.heartbeatAt && "lt" in entry.heartbeatAt,
				)?.heartbeatAt as { lt: Date } | undefined;
				const claimable =
					job.id === where.id &&
					job.status === where.status &&
					(job.runnerId === null ||
						job.runnerId === where.OR[1]?.runnerId ||
						job.heartbeatAt === null ||
						Boolean(staleBefore && job.heartbeatAt < staleBefore.lt));
				if (!claimable) return { count: 0 };
				job.runnerId = data.runnerId;
				job.heartbeatAt = data.heartbeatAt;
				return { count: 1 };
			},
		},
	} as unknown as Database;
}

describe("local service job leases", () => {
	test("does not steal a healthy runner lease", async () => {
		const now = new Date("2026-07-30T12:00:00.000Z");
		const db = createClaimDb({
			id: "job-1",
			status: "running",
			runnerId: "old-runner",
			heartbeatAt: new Date(now.getTime() - LOCAL_SERVICE_JOB_LEASE_MS + 1),
		});

		await expect(
			claimLocalServiceJob(db, {
				id: "job-1",
				runnerId: "new-runner",
				now,
			}),
		).resolves.toBe(false);
	});

	test("reclaims a job after its heartbeat lease expires", async () => {
		const now = new Date("2026-07-30T12:00:00.000Z");
		const job = {
			id: "job-1",
			status: "running",
			runnerId: "old-runner",
			heartbeatAt: new Date(now.getTime() - LOCAL_SERVICE_JOB_LEASE_MS - 1),
		};
		const db = createClaimDb(job);

		await expect(
			claimLocalServiceJob(db, {
				id: job.id,
				runnerId: "new-runner",
				now,
			}),
		).resolves.toBe(true);
		expect(job.runnerId).toBe("new-runner");
		expect(job.heartbeatAt).toEqual(now);
	});

	test("uses a singleton active key and releases it on completion", async () => {
		let createdData: Record<string, unknown> | undefined;
		let finishedData: Record<string, unknown> | undefined;
		const db = {
			localServiceJob: {
				create: async ({
					data,
				}: {
					data: Record<string, unknown>;
				}) => {
					createdData = data;
					return data;
				},
				updateMany: async ({
					data,
				}: {
					data: Record<string, unknown>;
				}) => {
					finishedData = data;
					return { count: 1 };
				},
			},
		} as unknown as Database;

		await createLocalServiceJob(db, {
			id: "job-1",
			kind: "telegram-recent-update",
			input: { channelIds: [1] },
			state: { status: "running" },
			runnerId: "runner-1",
		});
		expect(createdData?.activeKey).toBe("telegram-recent-update:active");

		await expect(
			finishLocalServiceJob(db, {
				id: "job-1",
				runnerId: "runner-1",
				status: "completed",
				state: { status: "completed" },
			}),
		).resolves.toBe(true);
		expect(finishedData?.activeKey).toBeNull();
	});
});
