import type { Database, Prisma } from "@acme/db";

export const LOCAL_SERVICE_JOB_LEASE_MS = 30_000;
export const LOCAL_SERVICE_JOB_HEARTBEAT_MS = 5_000;

export type StoredLocalServiceJob = {
	id: string;
	kind: string;
	activeKey: string | null;
	status: string;
	input: unknown;
	state: unknown;
	runnerId: string | null;
	heartbeatAt: Date | null;
	startedAt: Date;
	finishedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

type CreateLocalServiceJobInput = {
	id: string;
	kind: string;
	input: unknown;
	state: unknown;
	runnerId: string;
	now?: Date;
};

function toJobJson(value: unknown) {
	const encoded = JSON.stringify(value);
	if (encoded === undefined) {
		throw new Error("Local service job state must be JSON serializable.");
	}
	return JSON.parse(encoded) as Prisma.InputJsonValue;
}

export async function createLocalServiceJob(
	db: Database,
	input: CreateLocalServiceJobInput,
) {
	const now = input.now ?? new Date();
	return db.localServiceJob.create({
		data: {
			id: input.id,
			kind: input.kind,
			activeKey: `${input.kind}:active`,
			status: "running",
			input: toJobJson(input.input),
			state: toJobJson(input.state),
			runnerId: input.runnerId,
			heartbeatAt: now,
			startedAt: now,
		},
	});
}

export function findRunningLocalServiceJob(db: Database, kind: string) {
	return db.localServiceJob.findFirst({
		where: { activeKey: `${kind}:active`, status: "running" },
		orderBy: { createdAt: "desc" },
	});
}

export function findLatestFinishedLocalServiceJob(db: Database, kind: string) {
	return db.localServiceJob.findFirst({
		where: { kind, status: { not: "running" } },
		orderBy: { finishedAt: "desc" },
	});
}

export async function claimLocalServiceJob(
	db: Database,
	input: {
		id: string;
		runnerId: string;
		now?: Date;
		leaseMs?: number;
	},
) {
	const now = input.now ?? new Date();
	const staleBefore = new Date(
		now.getTime() - (input.leaseMs ?? LOCAL_SERVICE_JOB_LEASE_MS),
	);
	const claimed = await db.localServiceJob.updateMany({
		where: {
			id: input.id,
			status: "running",
			OR: [
				{ runnerId: null },
				{ runnerId: input.runnerId },
				{ heartbeatAt: null },
				{ heartbeatAt: { lt: staleBefore } },
			],
		},
		data: {
			runnerId: input.runnerId,
			heartbeatAt: now,
		},
	});
	return claimed.count === 1;
}

export async function heartbeatLocalServiceJob(
	db: Database,
	id: string,
	runnerId: string,
) {
	const updated = await db.localServiceJob.updateMany({
		where: { id, status: "running", runnerId },
		data: { heartbeatAt: new Date() },
	});
	return updated.count === 1;
}

export async function saveRunningLocalServiceJob(
	db: Database,
	input: {
		id: string;
		runnerId: string;
		state: unknown;
	},
) {
	const updated = await db.localServiceJob.updateMany({
		where: {
			id: input.id,
			status: "running",
			runnerId: input.runnerId,
		},
		data: {
			state: toJobJson(input.state),
			heartbeatAt: new Date(),
		},
	});
	return updated.count === 1;
}

export function replaceRunningLocalServiceJobState(
	db: Database,
	id: string,
	state: unknown,
) {
	return db.localServiceJob.updateMany({
		where: { id, status: "running" },
		data: { state: toJobJson(state) },
	});
}

export async function finishLocalServiceJob(
	db: Database,
	input: {
		id: string;
		runnerId: string;
		status: "completed" | "failed" | "cancelled";
		state: unknown;
	},
) {
	const now = new Date();
	const updated = await db.localServiceJob.updateMany({
		where: {
			id: input.id,
			status: "running",
			runnerId: input.runnerId,
		},
		data: {
			status: input.status,
			activeKey: null,
			state: toJobJson(input.state),
			runnerId: null,
			heartbeatAt: now,
			finishedAt: now,
		},
	});
	return updated.count === 1;
}
