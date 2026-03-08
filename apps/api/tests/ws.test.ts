import { afterEach, describe, expect, mock, test } from "bun:test";
import type { ServerWebSocket } from "bun";
import type { ServerEvent, Task } from "../src/types";

// ---------------------------------------------------------------------------
// Stub task-service BEFORE the handler module is imported.
// Bun resolves mock.module() synchronously before subsequent imports so the
// handler picks up our stubs instead of the real database-backed functions.
// ---------------------------------------------------------------------------

const FAKE_TASK: Task = {
  id: "task-1",
  title: "Hello",
  description: null,
  status: "todo",
  rank: "a0",
  titleVersion: 0,
  descriptionVersion: 0,
  positionVersion: 0,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  deletedAt: null,
};

const stubService = {
  getAllTasks: mock(async () => [FAKE_TASK]),
  getTask: mock(async (_id: string) => FAKE_TASK as Task | undefined),
  createTask: mock(async () => FAKE_TASK),
  editTaskTitle: mock(async () => ({ ok: true as const, task: FAKE_TASK })),
  editTaskDescription: mock(async () => ({
    ok: true as const,
    task: FAKE_TASK,
  })),
  moveTask: mock(async () => ({ ok: true as const, task: FAKE_TASK })),
  deleteTask: mock(async () => ({ ok: true as const, taskId: FAKE_TASK.id })),
};

mock.module("../src/services/task-service", () => stubService);

const { handleOpen, handleMessage, handleClose } = await import(
  "../src/ws/handler"
);

function makeWs(): { ws: ServerWebSocket<unknown>; sent: ServerEvent[] } {
  const sent: ServerEvent[] = [];
  const ws = {
    readyState: 1,
    send(raw: string) {
      sent.push(JSON.parse(raw) as ServerEvent);
    },
  } as unknown as ServerWebSocket<unknown>;

  return { ws, sent };
}

afterEach(() => {
  for (const fn of Object.values(stubService)) fn.mockClear();
});

describe("handleOpen", () => {
  test("sends BOARD_STATE with tasks from service", async () => {
    const { ws, sent } = makeWs();
    await handleOpen(ws);

    expect(stubService.getAllTasks).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.event).toBe("BOARD_STATE");

    const boardState = sent[0] as Extract<
      ServerEvent,
      { event: "BOARD_STATE" }
    >;
    expect(boardState.tasks).toHaveLength(1);
    expect(boardState.tasks[0]?.id).toBe(FAKE_TASK.id);
  });
});

describe("handleMessage — PRESENCE_UPDATE", () => {
  test("registers the client and broadcasts presence list", async () => {
    const { ws, sent } = makeWs();
    await handleMessage(ws, {
      action: "PRESENCE_UPDATE",
      userId: "user-1",
      displayName: "Brave Fox",
      color: "#FF5733",
    });

    expect(stubService.getAllTasks).not.toHaveBeenCalled();

    // PRESENCE_UPDATE broadcasts to all clients including the sender (no
    // exclude arg), so the ws receives its own updated presence list back.
    expect(sent).toHaveLength(1);
    const presence = sent[0] as Extract<
      ServerEvent,
      { event: "PRESENCE_UPDATE" }
    >;
    expect(presence.event).toBe("PRESENCE_UPDATE");
    expect(presence.users).toHaveLength(1);
    expect(presence.users[0]?.userId).toBe("user-1");
  });
});

describe("handleMessage — CREATE_TASK", () => {
  test("calls service and broadcasts TASK_CREATED", async () => {
    const { ws, sent } = makeWs();

    // Register ws in presence map first so it receives broadcasts.
    await handleMessage(ws, {
      action: "PRESENCE_UPDATE",
      userId: "user-1",
      displayName: "Brave Fox",
      color: "#FF5733",
    });
    sent.length = 0;

    await handleMessage(ws, {
      action: "CREATE_TASK",
      intentId: "intent-1",
      title: "  New Task  ",
      description: null,
      status: "todo",
      rank: "a0",
    });

    expect(stubService.createTask).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.event).toBe("TASK_CREATED");
  });

  test("rejects CREATE_TASK when title is blank", async () => {
    const { ws, sent } = makeWs();

    await handleMessage(ws, {
      action: "CREATE_TASK",
      intentId: "intent-bad",
      title: "   ",
      description: null,
      status: "todo",
      rank: "a0",
    });

    expect(stubService.createTask).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.event).toBe("ACTION_REJECTED");

    const rej = sent[0] as Extract<ServerEvent, { event: "ACTION_REJECTED" }>;
    expect(rej.intentId).toBe("intent-bad");
  });
});

describe("handleMessage — MOVE_TASK", () => {
  test("broadcasts TASK_UPDATED on successful move", async () => {
    const { ws, sent } = makeWs();
    await handleMessage(ws, {
      action: "PRESENCE_UPDATE",
      userId: "u1",
      displayName: "X",
      color: "#fff",
    });
    sent.length = 0;

    await handleMessage(ws, {
      action: "MOVE_TASK",
      intentId: "intent-move",
      taskId: FAKE_TASK.id,
      newStatus: "done",
      newRank: "b0",
      basePositionVersion: 0,
    });

    expect(stubService.moveTask).toHaveBeenCalledTimes(1);
    expect(sent[0]?.event).toBe("TASK_UPDATED");
  });

  test("sends ACTION_REJECTED on invalid status", async () => {
    const { ws, sent } = makeWs();

    await handleMessage(ws, {
      action: "MOVE_TASK",
      intentId: "intent-bad-status",
      taskId: FAKE_TASK.id,
      newStatus: "limbo", // not a valid status
      newRank: "b0",
      basePositionVersion: 0,
    } as never);

    expect(stubService.moveTask).not.toHaveBeenCalled();
    expect(sent[0]?.event).toBe("ACTION_REJECTED");

    const rej = sent[0] as Extract<ServerEvent, { event: "ACTION_REJECTED" }>;
    expect(rej.intentId).toBe("intent-bad-status");
  });

  test("sends ACTION_REJECTED with serverState when service rejects move", async () => {
    const { ws, sent } = makeWs();
    await handleMessage(ws, {
      action: "PRESENCE_UPDATE",
      userId: "u1",
      displayName: "X",
      color: "#fff",
    });
    sent.length = 0;

    stubService.moveTask.mockImplementationOnce(
      async () =>
        ({
          ok: false as const,
          reason: "A newer move has already been applied.",
          serverState: FAKE_TASK,
        }) as never,
    );

    await handleMessage(ws, {
      action: "MOVE_TASK",
      intentId: "intent-stale",
      taskId: FAKE_TASK.id,
      newStatus: "done",
      newRank: "b0",
      basePositionVersion: 0,
    });

    expect(sent[0]?.event).toBe("ACTION_REJECTED");
    const rej = sent[0] as Extract<ServerEvent, { event: "ACTION_REJECTED" }>;
    expect(rej.intentId).toBe("intent-stale");
    expect(rej.serverState?.id).toBe(FAKE_TASK.id);
  });
});

describe("handleMessage — DELETE_TASK", () => {
  test("broadcasts TASK_DELETED on success", async () => {
    const { ws, sent } = makeWs();
    await handleMessage(ws, {
      action: "PRESENCE_UPDATE",
      userId: "u1",
      displayName: "X",
      color: "#fff",
    });
    sent.length = 0;

    await handleMessage(ws, {
      action: "DELETE_TASK",
      intentId: "intent-del",
      taskId: FAKE_TASK.id,
    });

    expect(stubService.deleteTask).toHaveBeenCalledTimes(1);
    expect(sent[0]?.event).toBe("TASK_DELETED");

    const del = sent[0] as Extract<ServerEvent, { event: "TASK_DELETED" }>;
    expect(del.taskId).toBe(FAKE_TASK.id);
  });
});

describe("handleMessage — unknown action", () => {
  test("sends ACTION_REJECTED for unknown action type", async () => {
    const { ws, sent } = makeWs();

    await handleMessage(ws, {
      action: "EXPLODE_SERVER",
      intentId: "x",
    } as never);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.event).toBe("ACTION_REJECTED");
  });
});

describe("handleClose", () => {
  test("removes client from presence without throwing", () => {
    const { ws } = makeWs();
    expect(() => handleClose(ws)).not.toThrow();
  });
});
