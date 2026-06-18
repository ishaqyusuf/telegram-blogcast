import { db } from "../src/index.js";

const WRITE_FLAG = "--write";

type CountRow = {
  count: bigint | number;
};

function toCount(rows: CountRow[]) {
  return Number(rows[0]?.count ?? 0);
}

async function countCandidates(table: string, column: string) {
  const rows = await db.$queryRawUnsafe<CountRow[]>(
    `
      SELECT COUNT(*)::bigint AS count
      FROM "${table}"
      WHERE "${column}" ~* '^https?://([^/]+\\.)*shamela\\.ws/book/'
    `,
  );
  return toCount(rows);
}

async function compactColumn(table: string, column: string) {
  return db.$executeRawUnsafe(
    `
      UPDATE "${table}"
      SET "${column}" = regexp_replace(
        "${column}",
        '^https?://([^/]+\\.)*shamela\\.ws(?=/book/)',
        '',
        'i'
      )
      WHERE "${column}" ~* '^https?://([^/]+\\.)*shamela\\.ws/book/'
    `,
  );
}

async function main() {
  const shouldWrite = process.argv.includes(WRITE_FLAG);
  const targets = [
    { table: "Book", column: "shamelaUrl" },
    { table: "BookPage", column: "shamelaUrl" },
    { table: "BookTocNode", column: "shamelaPath" },
  ];

  const before = await Promise.all(
    targets.map(async (target) => ({
      ...target,
      count: await countCandidates(target.table, target.column),
    })),
  );

  console.table(before);

  if (!shouldWrite) {
    console.log(`Dry run only. Re-run with ${WRITE_FLAG} to compact these rows.`);
    return;
  }

  for (const target of targets) {
    const updated = await compactColumn(target.table, target.column);
    console.log(`${target.table}.${target.column}: compacted ${updated} rows`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
