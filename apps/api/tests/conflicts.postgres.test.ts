import { afterAll, beforeAll, mock } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { runConflictSuite } from "./task-service-suite";

const pglite = new PGlite();

// Bun SQL uses tagged template literals where interpolated values become bound
// parameters. PGlite exposes a similar but distinct API. This adapter bridges
// the two: it reconstructs $1, $2, ... placeholders and delegates to PGlite.
function makePgliteDb(pg: PGlite) {
  return async function db<T = unknown>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T> {
    let sql = "";
    for (let i = 0; i < strings.length; i++) {
      sql += strings[i];
      if (i < values.length) sql += `$${i + 1}`;
    }
    const result = await pg.query(sql, values as never[]);
    return result.rows as T;
  };
}

mock.module("../src/db", () => ({ db: makePgliteDb(pglite) }));
mock.module("../src/db/config", () => ({
  databaseDialect: "postgres",
  databaseUrl: "",
}));

const { migrate } = await import("../src/db/schema");
const taskService = await import("../src/services/task-service");

beforeAll(async () => {
  await pglite.waitReady;
  await migrate();
});

afterAll(async () => {
  await pglite.query("DROP TABLE IF EXISTS tasks");
});

runConflictSuite(taskService, async () => {
  await pglite.query("DELETE FROM tasks");
});
