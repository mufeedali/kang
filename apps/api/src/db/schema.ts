import { databaseDialect } from "./config";
import { db } from "./index.ts";

function isDuplicateColumnError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const errno = (err as { errno?: string })?.errno;
  const message = (err as { message?: string })?.message ?? "";

  return (
    code === "42701" ||
    errno === "42701" ||
    (typeof code === "string" && code.startsWith("SQLITE_ERROR")) ||
    message.toLowerCase().includes("duplicate column name") ||
    message.toLowerCase().includes("already exists")
  );
}

async function addColumnIfMissing(sql: TemplateStringsArray, value?: unknown) {
  try {
    await db(sql, ...(value === undefined ? [] : [value]));
  } catch (err) {
    if (!isDuplicateColumnError(err)) {
      throw err;
    }
  }
}

async function migratePostgres() {
  await db`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      rank TEXT NOT NULL,
      title_version INTEGER NOT NULL DEFAULT 0,
      description_version INTEGER NOT NULL DEFAULT 0,
      position_version INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `;

  await addColumnIfMissing`
    ALTER TABLE tasks ADD COLUMN title_version INTEGER NOT NULL DEFAULT 0
  `;
  await addColumnIfMissing`
    ALTER TABLE tasks ADD COLUMN description_version INTEGER NOT NULL DEFAULT 0
  `;
  await addColumnIfMissing`
    ALTER TABLE tasks ADD COLUMN position_version INTEGER NOT NULL DEFAULT 0
  `;
  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS tasks_status_rank_unique
    ON tasks (status, rank)
    WHERE deleted_at IS NULL
  `;
}

async function migrateSqlite() {
  await db`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      rank TEXT NOT NULL,
      title_version INTEGER NOT NULL DEFAULT 0,
      description_version INTEGER NOT NULL DEFAULT 0,
      position_version INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      deleted_at INTEGER
    )
  `;

  await addColumnIfMissing`
    ALTER TABLE tasks ADD COLUMN title_version INTEGER NOT NULL DEFAULT 0
  `;
  await addColumnIfMissing`
    ALTER TABLE tasks ADD COLUMN description_version INTEGER NOT NULL DEFAULT 0
  `;
  await addColumnIfMissing`
    ALTER TABLE tasks ADD COLUMN position_version INTEGER NOT NULL DEFAULT 0
  `;
  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS tasks_status_rank_unique
    ON tasks (status, rank)
    WHERE deleted_at IS NULL
  `;
}

export async function migrate() {
  if (databaseDialect === "sqlite") {
    await migrateSqlite();
    return;
  }

  await migratePostgres();
}
