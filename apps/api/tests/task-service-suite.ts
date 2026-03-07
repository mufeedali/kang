import { afterEach, describe, expect, test } from "bun:test";
import type * as TaskServiceType from "../src/services/task-service";

function uuid() {
  return crypto.randomUUID();
}

export function runConflictSuite(
  svc: typeof TaskServiceType,
  cleanup: () => Promise<void>,
) {
  afterEach(cleanup);

  async function createTask(
    overrides: {
      title?: string;
      status?: "todo" | "in_progress" | "done";
    } = {},
  ) {
    return svc.createTask({
      action: "CREATE_TASK",
      intentId: uuid(),
      title: overrides.title ?? "Test Task",
      description: null,
      status: overrides.status ?? "todo",
      rank: "a0",
      timestamp: Date.now(),
    });
  }

  describe("Scenario 1: Concurrent Move + Edit (disjoint fields)", () => {
    test("both changes are preserved when targeting different fields", async () => {
      const task = await createTask({ title: "Original", status: "todo" });
      const now = Date.now();

      const moveResult = await svc.moveTask({
        action: "MOVE_TASK",
        intentId: uuid(),
        taskId: task.id,
        newStatus: "done",
        newRank: "b0",
        timestamp: now + 1,
      });
      expect(moveResult.ok).toBe(true);

      const editResult = await svc.editTaskTitle({
        action: "EDIT_TASK_TITLE",
        intentId: uuid(),
        taskId: task.id,
        newTitle: "Updated Title",
        timestamp: now + 2,
      });
      expect(editResult.ok).toBe(true);

      const final = await svc.getTask(task.id);
      expect(final?.title).toBe("Updated Title");
      expect(final?.status).toBe("done");
    });
  });

  describe("Scenario 2: Concurrent Move + Move (LWW)", () => {
    test("later timestamp wins for same-field conflict", async () => {
      const task = await createTask({ status: "todo" });
      const baseTime = Date.now();

      const resultA = await svc.moveTask({
        action: "MOVE_TASK",
        intentId: uuid(),
        taskId: task.id,
        newStatus: "in_progress",
        newRank: "b0",
        timestamp: baseTime + 1,
      });
      expect(resultA.ok).toBe(true);

      const resultB = await svc.moveTask({
        action: "MOVE_TASK",
        intentId: uuid(),
        taskId: task.id,
        newStatus: "done",
        newRank: "c0",
        timestamp: baseTime + 2,
      });
      expect(resultB.ok).toBe(true);

      const final = await svc.getTask(task.id);
      expect(final?.status).toBe("done");
    });

    test("earlier timestamp is rejected by the service", async () => {
      const task = await createTask({ status: "todo" });
      const baseTime = Date.now();

      await svc.moveTask({
        action: "MOVE_TASK",
        intentId: uuid(),
        taskId: task.id,
        newStatus: "done",
        newRank: "c0",
        timestamp: baseTime + 10,
      });

      const staleResult = await svc.moveTask({
        action: "MOVE_TASK",
        intentId: uuid(),
        taskId: task.id,
        newStatus: "in_progress",
        newRank: "b0",
        timestamp: baseTime + 1,
      });

      expect(staleResult.ok).toBe(false);
      if (!staleResult.ok) {
        expect(staleResult.serverState?.status).toBe("done");
      }
    });
  });

  describe("Scenario 3: Concurrent Reorder + Add", () => {
    test("unique ranks prevent collisions when reordering and adding simultaneously", async () => {
      const taskA = await svc.createTask({
        action: "CREATE_TASK",
        intentId: uuid(),
        title: "Task A",
        description: null,
        status: "todo",
        rank: "a0",
        timestamp: Date.now(),
      });
      const taskB = await svc.createTask({
        action: "CREATE_TASK",
        intentId: uuid(),
        title: "Task B",
        description: null,
        status: "todo",
        rank: "a1",
        timestamp: Date.now(),
      });

      const reorderResult = await svc.moveTask({
        action: "MOVE_TASK",
        intentId: uuid(),
        taskId: taskB.id,
        newStatus: "todo",
        newRank: "Zz",
        timestamp: Date.now() + 1,
      });
      expect(reorderResult.ok).toBe(true);

      const newTask = await svc.createTask({
        action: "CREATE_TASK",
        intentId: uuid(),
        title: "Task C (new)",
        description: null,
        status: "todo",
        rank: "a2",
        timestamp: Date.now() + 1,
      });

      const allTasks = await svc.getAllTasks();
      expect(allTasks.length).toBe(3);

      const ranks = allTasks.map((t) => t.rank);
      expect(new Set(ranks).size).toBe(3);

      const ids = new Set(allTasks.map((t) => t.id));
      expect(ids.has(taskA.id)).toBe(true);
      expect(ids.has(taskB.id)).toBe(true);
      expect(ids.has(newTask.id)).toBe(true);
    });
  });

  describe("Scenario 4: Delete + Edit (Tombstone wins)", () => {
    test("edit is rejected when task is tombstoned", async () => {
      const task = await createTask({ title: "Original" });
      const now = Date.now();

      const deleteResult = await svc.deleteTask({
        action: "DELETE_TASK",
        intentId: uuid(),
        taskId: task.id,
        timestamp: now + 1,
      });
      expect(deleteResult.ok).toBe(true);

      const editResult = await svc.editTaskTitle({
        action: "EDIT_TASK_TITLE",
        intentId: uuid(),
        taskId: task.id,
        newTitle: "Should Not Apply",
        timestamp: now + 2,
      });

      expect(editResult.ok).toBe(false);

      const activeTask = await svc.getTask(task.id);
      expect(activeTask).toBeUndefined();
    });

    test("tombstoned tasks are excluded from getAllTasks", async () => {
      await createTask({ title: "Active Task" });
      const toDelete = await createTask({ title: "Deleted Task" });

      await svc.deleteTask({
        action: "DELETE_TASK",
        intentId: uuid(),
        taskId: toDelete.id,
        timestamp: Date.now(),
      });

      const active = await svc.getAllTasks();
      expect(active.length).toBe(1);
      expect(active[0]?.title).toBe("Active Task");
    });
  });

  describe("Scenario 5: Delete + Delete (idempotent)", () => {
    test("double delete is a harmless no-op", async () => {
      const task = await createTask();

      const first = await svc.deleteTask({
        action: "DELETE_TASK",
        intentId: uuid(),
        taskId: task.id,
        timestamp: Date.now(),
      });
      expect(first.ok).toBe(true);

      const second = await svc.deleteTask({
        action: "DELETE_TASK",
        intentId: uuid(),
        taskId: task.id,
        timestamp: Date.now() + 1,
      });
      expect(second.ok).toBe(true);

      const active = await svc.getAllTasks();
      expect(active.length).toBe(0);
    });
  });

  describe("Scenario 6: Edit + Edit — same field (LWW)", () => {
    test("later timestamp wins when two clients edit the same field", async () => {
      const task = await createTask({ title: "Original" });
      const baseTime = Date.now();

      const resultA = await svc.editTaskTitle({
        action: "EDIT_TASK_TITLE",
        intentId: uuid(),
        taskId: task.id,
        newTitle: "User A Title",
        timestamp: baseTime + 1,
      });
      expect(resultA.ok).toBe(true);

      const resultB = await svc.editTaskTitle({
        action: "EDIT_TASK_TITLE",
        intentId: uuid(),
        taskId: task.id,
        newTitle: "User B Title",
        timestamp: baseTime + 2,
      });
      expect(resultB.ok).toBe(true);

      const final = await svc.getTask(task.id);
      expect(final?.title).toBe("User B Title");
    });

    test("stale edit to same field is rejected by the service", async () => {
      const task = await createTask({ title: "Original" });
      const baseTime = Date.now();

      await svc.editTaskTitle({
        action: "EDIT_TASK_TITLE",
        intentId: uuid(),
        taskId: task.id,
        newTitle: "Newer Title",
        timestamp: baseTime + 10,
      });

      const staleResult = await svc.editTaskTitle({
        action: "EDIT_TASK_TITLE",
        intentId: uuid(),
        taskId: task.id,
        newTitle: "Older Title",
        timestamp: baseTime + 1,
      });

      expect(staleResult.ok).toBe(false);
      if (!staleResult.ok) {
        expect(staleResult.serverState?.title).toBe("Newer Title");
      }
    });
  });

  describe("Scenario 7: Edit title + Edit description (disjoint fields)", () => {
    test("both edits apply independently without conflict", async () => {
      const task = await createTask({ title: "Original" });
      const baseTime = Date.now();

      const titleResult = await svc.editTaskTitle({
        action: "EDIT_TASK_TITLE",
        intentId: uuid(),
        taskId: task.id,
        newTitle: "New Title",
        timestamp: baseTime + 1,
      });
      expect(titleResult.ok).toBe(true);

      const descResult = await svc.editTaskDescription({
        action: "EDIT_TASK_DESCRIPTION",
        intentId: uuid(),
        taskId: task.id,
        newDescription: "New Description",
        timestamp: baseTime + 2,
      });
      expect(descResult.ok).toBe(true);

      const final = await svc.getTask(task.id);
      expect(final?.title).toBe("New Title");
      expect(final?.description).toBe("New Description");
    });
  });

  describe("Scenario 8: Multi-client same-rank collision (optimistic retry)", () => {
    test("two creates with identical ranks both succeed with unique ranks", async () => {
      const [taskA, taskB] = await Promise.all([
        svc.createTask({
          action: "CREATE_TASK",
          intentId: uuid(),
          title: "Client A Task",
          description: null,
          status: "todo",
          rank: "a0",
          timestamp: Date.now(),
        }),
        svc.createTask({
          action: "CREATE_TASK",
          intentId: uuid(),
          title: "Client B Task",
          description: null,
          status: "todo",
          rank: "a0",
          timestamp: Date.now(),
        }),
      ]);

      expect(taskA).toBeDefined();
      expect(taskB).toBeDefined();
      expect(taskA.rank).not.toBe(taskB.rank);

      const all = await svc.getAllTasks();
      expect(all.length).toBe(2);
      const [first, second] = all as [(typeof all)[0], (typeof all)[0]];
      expect(first.rank < second.rank).toBe(true);
    });
  });
}
