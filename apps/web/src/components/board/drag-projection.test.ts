import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyBetween } from "fractional-indexing";
import type { Task } from "@/types";
import { getColumnEndDropId, projectTaskMove } from "./drag-projection";

function makeTask(
  overrides: Partial<Task> & Pick<Task, "id" | "status" | "rank">,
): Task {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    description: overrides.description ?? null,
    status: overrides.status,
    rank: overrides.rank,
    titleVersion: overrides.titleVersion ?? 0,
    descriptionVersion: overrides.descriptionVersion ?? 0,
    positionVersion: overrides.positionVersion ?? 0,
    createdAt: overrides.createdAt ?? "2026-03-08T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-03-08T00:00:00.000Z",
    deletedAt: overrides.deletedAt ?? null,
  };
}

test("returns null when re-dropping the lone remaining task at column end", () => {
  const tasks = [
    makeTask({ id: "moved-away", status: "done", rank: "a0" }),
    makeTask({ id: "remaining", status: "todo", rank: "b0" }),
  ];

  const projected = projectTaskMove(
    tasks,
    "remaining",
    getColumnEndDropId("todo"),
  );

  assert.equal(projected, null);
});

test("returns null when re-dropping the lone task onto the column container", () => {
  const tasks = [makeTask({ id: "remaining", status: "todo", rank: "b0" })];

  const projected = projectTaskMove(tasks, "remaining", "todo");

  assert.equal(projected, null);
});

test("still generates a new rank for a real same-column move", () => {
  const firstRank = generateKeyBetween(null, null);
  const secondRank = generateKeyBetween(firstRank, null);
  const thirdRank = generateKeyBetween(secondRank, null);

  const tasks = [
    makeTask({ id: "first", status: "todo", rank: firstRank }),
    makeTask({ id: "second", status: "todo", rank: secondRank }),
    makeTask({ id: "third", status: "todo", rank: thirdRank }),
  ];

  const projected = projectTaskMove(tasks, "first", getColumnEndDropId("todo"));

  assert.deepEqual(projected, {
    status: "todo",
    rank: generateKeyBetween(thirdRank, null),
  });
});
