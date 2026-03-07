import { beforeAll, mock } from "bun:test";
import { SQL } from "bun";
import { runConflictSuite } from "./task-service-suite";

const sqliteDb = new SQL(":memory:");

mock.module("../src/db", () => ({ db: sqliteDb }));
mock.module("../src/db/config", () => ({
  databaseDialect: "sqlite",
  databaseUrl: ":memory:",
}));

const { migrate } = await import("../src/db/schema");
const taskService = await import("../src/services/task-service");

beforeAll(async () => {
  await migrate();
});

runConflictSuite(taskService, async () => {
  await sqliteDb`DELETE FROM tasks`;
});
