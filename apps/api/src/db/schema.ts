import { databaseDialect } from "./config";
import { db } from "./index.ts";

async function migratePostgres() {
  await db`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      rank TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
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
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      deleted_at INTEGER
    )
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
