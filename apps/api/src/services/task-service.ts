import { generateKeyBetween } from "fractional-indexing";
import { db } from "../db";
import { databaseDialect } from "../db/config";
import type {
  CreateTaskIntent,
  DeleteTaskIntent,
  EditTaskDescriptionIntent,
  EditTaskTitleIntent,
  MoveTaskIntent,
  Task,
} from "../types";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  rank: string;
  // Postgres returns Date objects; SQLite returns ms integers.
  created_at: Date | number;
  updated_at: Date | number;
  deleted_at: Date | number | null;
}

function toIso(value: Date | number): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as Task["status"],
    rank: row.rank,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    deletedAt: row.deleted_at != null ? toIso(row.deleted_at) : null,
  };
}

function toMs(value: Date | number): number {
  return value instanceof Date ? value.getTime() : value;
}

function isNewer(
  intentTimestamp: number,
  rowUpdatedAt: Date | number,
): boolean {
  return intentTimestamp > toMs(rowUpdatedAt);
}

// Postgres stores timestamps as TIMESTAMPTZ (bind a Date); SQLite stores them
// as INTEGER ms (bind the raw number).
function dbTimestamp(ms: number): Date | number {
  return databaseDialect === "sqlite" ? ms : new Date(ms);
}

function isUniqueConstraintError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return (
    code === "23505" ||
    (typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT"))
  );
}

async function getActiveTaskRow(taskId: string): Promise<TaskRow | undefined> {
  const [row] = await db<TaskRow[]>`
    SELECT * FROM tasks
    WHERE id = ${taskId} AND deleted_at IS NULL
  `;
  return row;
}

export async function getAllTasks(): Promise<Task[]> {
  const rows = await db<TaskRow[]>`
    SELECT * FROM tasks
    WHERE deleted_at IS NULL
    ORDER BY rank
  `;
  return rows.map(toTask);
}

export async function getTask(taskId: string): Promise<Task | undefined> {
  const row = await getActiveTaskRow(taskId);
  return row ? toTask(row) : undefined;
}

// Optimistic insert: if the (status, rank) unique constraint fires because two
// clients raced on the same base rank, re-fetch the column tail and retry.
export async function createTask(intent: CreateTaskIntent): Promise<Task> {
  let rank = intent.rank;

  for (;;) {
    try {
      const [row] = await db<TaskRow[]>`
        INSERT INTO tasks (id, title, description, status, rank)
        VALUES (
          ${intent.intentId},
          ${intent.title.trim()},
          ${intent.description?.trim() || null},
          ${intent.status},
          ${rank}
        )
        RETURNING *
      `;
      return toTask(row as TaskRow);
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;

      const [tail] = await db<{ rank: string }[]>`
        SELECT rank FROM tasks
        WHERE status = ${intent.status} AND deleted_at IS NULL
        ORDER BY rank DESC
        LIMIT 1
      `;
      rank = generateKeyBetween(tail?.rank ?? null, null);
    }
  }
}

export async function editTaskTitle(
  intent: EditTaskTitleIntent,
): Promise<
  { ok: true; task: Task } | { ok: false; reason: string; serverState?: Task }
> {
  const existing = await getActiveTaskRow(intent.taskId);

  if (!existing) {
    return { ok: false, reason: "Task not found or has been deleted." };
  }

  if (!isNewer(intent.timestamp, existing.updated_at)) {
    return {
      ok: false,
      reason: "A newer edit has already been applied.",
      serverState: toTask(existing),
    };
  }

  const [updated] = await db<TaskRow[]>`
    UPDATE tasks
    SET title = ${intent.newTitle.trim()}, updated_at = ${dbTimestamp(intent.timestamp)}
    WHERE id = ${intent.taskId}
    RETURNING *
  `;
  return { ok: true, task: toTask(updated as TaskRow) };
}

export async function editTaskDescription(
  intent: EditTaskDescriptionIntent,
): Promise<
  { ok: true; task: Task } | { ok: false; reason: string; serverState?: Task }
> {
  const existing = await getActiveTaskRow(intent.taskId);

  if (!existing) {
    return { ok: false, reason: "Task not found or has been deleted." };
  }

  if (!isNewer(intent.timestamp, existing.updated_at)) {
    return {
      ok: false,
      reason: "A newer edit has already been applied.",
      serverState: toTask(existing),
    };
  }

  const [updated] = await db<TaskRow[]>`
    UPDATE tasks
    SET description = ${intent.newDescription.trim()}, updated_at = ${dbTimestamp(intent.timestamp)}
    WHERE id = ${intent.taskId}
    RETURNING *
  `;
  return { ok: true, task: toTask(updated as TaskRow) };
}

// Concurrent move+edit on the same task are safe because edit intents only
// touch title/description while move intents only touch status+rank.
export async function moveTask(
  intent: MoveTaskIntent,
): Promise<
  { ok: true; task: Task } | { ok: false; reason: string; serverState?: Task }
> {
  const existing = await getActiveTaskRow(intent.taskId);

  if (!existing) {
    return { ok: false, reason: "Task not found or has been deleted." };
  }

  if (!isNewer(intent.timestamp, existing.updated_at)) {
    return {
      ok: false,
      reason: "A newer move has already been applied.",
      serverState: toTask(existing),
    };
  }

  const [updated] = await db<TaskRow[]>`
    UPDATE tasks
    SET status = ${intent.newStatus}, rank = ${intent.newRank}, updated_at = ${dbTimestamp(intent.timestamp)}
    WHERE id = ${intent.taskId}
    RETURNING *
  `;
  return { ok: true, task: toTask(updated as TaskRow) };
}

// Soft-delete (tombstone). Idempotent: already-deleted tasks are a no-op.
export async function deleteTask(
  intent: DeleteTaskIntent,
): Promise<
  | { ok: true; taskId: string }
  | { ok: false; reason: string; serverState: Task }
> {
  const [existing] = await db<TaskRow[]>`
    SELECT * FROM tasks WHERE id = ${intent.taskId}
  `;

  if (!existing || existing.deleted_at !== null) {
    return { ok: true, taskId: intent.taskId };
  }

  await db`
    UPDATE tasks
    SET deleted_at = ${dbTimestamp(intent.timestamp)}
    WHERE id = ${intent.taskId}
  `;
  return { ok: true, taskId: intent.taskId };
}
