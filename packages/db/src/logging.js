// Prisma messages can contain query arguments, including private annotation text.
export const privateDatabaseLogs = [
	{ emit: "event", level: "error" },
	{ emit: "event", level: "warn" },
];

export function databaseLogDetails(level) {
	return {
		category: "database",
		level,
		message: "Database diagnostic; query details withheld.",
	};
}
