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
    });
  }

  describe("Scenario 1: Concurrent Move + Edit (disjoint fields)", () => {
    test("both changes are preserved when targeting different fields", async () => {
      const task = await createTask({ title: "Original", status: "todo" });

      const moveResult = await svc.moveTask({
        action: "MOVE_TASK",
        intentId: uuid(),
        taskId: task.id,
        newStatus: "done",
        newRank: "b0",
        basePositionVersion: task.positionVersion,
      });
      expect(moveResult.ok).toBe(true);

      const editResult = await svc.editTaskTitle({
        action: "EDIT_TASK_TITLE",
        intentId: uuid(),
        taskId: task.id,
        newTitle: "Updated Title",
        baseTitleVersion: task.titleVersion,
      });
      expect(editResult.ok).toBe(true);

      const final = await svc.getTask(task.id);
      expect(final?.title).toBe("Updated Title");
      expect(final?.status).toBe("done");
    });
  });

  describe("Scenario 2: Concurrent Move + Move (LWW)", () => {
    test("later accepted move wins when it uses the current position version", async () => {
      const task = await createTask({ status: "todo" });

      const resultA = await svc.moveTask({
        action: "MOVE_TASK",
        intentId: uuid(),
        taskId: task.id,
        newStatus: "in_progress",
        newRank: "b0",
        basePositionVersion: task.positionVersion,
      });
      expect(resultA.ok).toBe(true);
      if (!resultA.ok) {
        throw new Error("Expected first move to succeed");
      }

      const resultB = await svc.moveTask({
        action: "MOVE_TASK",
        intentId: uuid(),
        taskId: task.id,
        newStatus: "done",
        newRank: "c0",
        basePositionVersion: resultA.task.positionVersion,
      });
      expect(resultB.ok).toBe(true);

      const final = await svc.getTask(task.id);
      expect(final?.status).toBe("done");
    });

    test("stale position version is rejected by the service", async () => {
      const task = await createTask({ status: "todo" });

      await svc.moveTask({
        action: "MOVE_TASK",
        intentId: uuid(),
        taskId: task.id,
        newStatus: "done",
        newRank: "c0",
        basePositionVersion: task.positionVersion,
      });

      const staleResult = await svc.moveTask({
        action: "MOVE_TASK",
        intentId: uuid(),
        taskId: task.id,
        newStatus: "in_progress",
        newRank: "b0",
        basePositionVersion: task.positionVersion,
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
      });
      const taskB = await svc.createTask({
        action: "CREATE_TASK",
        intentId: uuid(),
        title: "Task B",
        description: null,
        status: "todo",
        rank: "a1",
      });

      const reorderResult = await svc.moveTask({
        action: "MOVE_TASK",
        intentId: uuid(),
        taskId: taskB.id,
        newStatus: "todo",
        newRank: "Zz",
        basePositionVersion: taskB.positionVersion,
      });
      expect(reorderResult.ok).toBe(true);

      const newTask = await svc.createTask({
        action: "CREATE_TASK",
        intentId: uuid(),
        title: "Task C (new)",
        description: null,
        status: "todo",
        rank: "a2",
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

      const deleteResult = await svc.deleteTask({
        action: "DELETE_TASK",
        intentId: uuid(),
        taskId: task.id,
      });
      expect(deleteResult.ok).toBe(true);

      const editResult = await svc.editTaskTitle({
        action: "EDIT_TASK_TITLE",
        intentId: uuid(),
        taskId: task.id,
        newTitle: "Should Not Apply",
        baseTitleVersion: task.titleVersion,
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
      });
      expect(first.ok).toBe(true);

      const second = await svc.deleteTask({
        action: "DELETE_TASK",
        intentId: uuid(),
        taskId: task.id,
      });
      expect(second.ok).toBe(true);

      const active = await svc.getAllTasks();
      expect(active.length).toBe(0);
    });
  });

  describe("Scenario 6: Edit + Edit — same field (LWW)", () => {
    test("later accepted title edit wins when it uses the current version", async () => {
      const task = await createTask({ title: "Original" });

      const resultA = await svc.editTaskTitle({
        action: "EDIT_TASK_TITLE",
        intentId: uuid(),
        taskId: task.id,
        newTitle: "User A Title",
        baseTitleVersion: task.titleVersion,
      });
      expect(resultA.ok).toBe(true);
      if (!resultA.ok) {
        throw new Error("Expected first title edit to succeed");
      }

      const resultB = await svc.editTaskTitle({
        action: "EDIT_TASK_TITLE",
        intentId: uuid(),
        taskId: task.id,
        newTitle: "User B Title",
        baseTitleVersion: resultA.task.titleVersion,
      });
      expect(resultB.ok).toBe(true);

      const final = await svc.getTask(task.id);
      expect(final?.title).toBe("User B Title");
    });

    test("stale title version is rejected by the service", async () => {
      const task = await createTask({ title: "Original" });

      await svc.editTaskTitle({
        action: "EDIT_TASK_TITLE",
        intentId: uuid(),
        taskId: task.id,
        newTitle: "Newer Title",
        baseTitleVersion: task.titleVersion,
      });

      const staleResult = await svc.editTaskTitle({
        action: "EDIT_TASK_TITLE",
        intentId: uuid(),
        taskId: task.id,
        newTitle: "Older Title",
        baseTitleVersion: task.titleVersion,
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

      const titleResult = await svc.editTaskTitle({
        action: "EDIT_TASK_TITLE",
        intentId: uuid(),
        taskId: task.id,
        newTitle: "New Title",
        baseTitleVersion: task.titleVersion,
      });
      expect(titleResult.ok).toBe(true);

      const descResult = await svc.editTaskDescription({
        action: "EDIT_TASK_DESCRIPTION",
        intentId: uuid(),
        taskId: task.id,
        newDescription: "New Description",
        baseDescriptionVersion: task.descriptionVersion,
      });
      expect(descResult.ok).toBe(true);

      const final = await svc.getTask(task.id);
      expect(final?.title).toBe("New Title");
      expect(final?.description).toBe("New Description");
    });

    test("replaying a cleared description is idempotent", async () => {
      const task = await svc.createTask({
        action: "CREATE_TASK",
        intentId: uuid(),
        title: "Original",
        description: "Has description",
        status: "todo",
        rank: "a0",
      });

      const cleared = await svc.editTaskDescription({
        action: "EDIT_TASK_DESCRIPTION",
        intentId: uuid(),
        taskId: task.id,
        newDescription: "   ",
        baseDescriptionVersion: task.descriptionVersion,
      });
      expect(cleared.ok).toBe(true);
      if (!cleared.ok) {
        throw new Error("Expected clearing the description to succeed");
      }
      expect(cleared.task.description).toBeNull();

      const replayed = await svc.editTaskDescription({
        action: "EDIT_TASK_DESCRIPTION",
        intentId: uuid(),
        taskId: task.id,
        newDescription: "   ",
        baseDescriptionVersion: task.descriptionVersion,
      });
      expect(replayed.ok).toBe(true);
      if (!replayed.ok) {
        throw new Error("Expected replayed description clear to be idempotent");
      }
      expect(replayed.task.description).toBeNull();
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
        }),
        svc.createTask({
          action: "CREATE_TASK",
          intentId: uuid(),
          title: "Client B Task",
          description: null,
          status: "todo",
          rank: "a0",
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
