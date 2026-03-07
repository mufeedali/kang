import type { ServerWebSocket } from "bun";
import * as taskService from "../services/task-service";
import type { ClientIntent, ServerEvent, UserInfo } from "../types";

// Elysia creates a new ElysiaWS wrapper on every event (open, message, close)
// even though they all wrap the same underlying Bun ServerWebSocket. Using the
// wrappers as Map keys breaks === identity across events, so we extract the
// stable underlying socket for consistent keying.
function getRaw(ws: ServerWebSocket<unknown>): ServerWebSocket<unknown> {
  return (ws as unknown as { raw?: ServerWebSocket<unknown> }).raw ?? ws;
}

// In-memory presence map: raw WebSocket → UserInfo
const connectedClients = new Map<ServerWebSocket<unknown>, UserInfo>();

function broadcast(event: ServerEvent, exclude?: ServerWebSocket<unknown>) {
  const message = JSON.stringify(event);
  for (const [raw] of connectedClients) {
    if (raw !== exclude && raw.readyState === 1) {
      raw.send(message);
    }
  }
}

function send(ws: ServerWebSocket<unknown>, event: ServerEvent) {
  const raw = getRaw(ws);
  if (raw.readyState === 1) {
    raw.send(JSON.stringify(event));
  }
}

function getPresenceList(): UserInfo[] {
  // Deduplicate by userId to handle the same user in multiple tabs.
  const seen = new Map<string, UserInfo>();
  for (const info of connectedClients.values()) {
    seen.set(info.userId, info);
  }
  return [...seen.values()];
}

export async function handleOpen(ws: ServerWebSocket<unknown>) {
  const tasks = await taskService.getAllTasks();
  send(ws, { event: "BOARD_STATE", tasks, users: getPresenceList() });
}

export async function handleMessage(
  ws: ServerWebSocket<unknown>,
  raw: string | Buffer,
) {
  let intent: ClientIntent;

  try {
    intent = JSON.parse(typeof raw === "string" ? raw : raw.toString());
  } catch {
    send(ws, {
      event: "ACTION_REJECTED",
      intentId: "unknown",
      reason: "Invalid JSON payload.",
    });
    return;
  }

  const validStatuses = ["todo", "in_progress", "done"];

  switch (intent.action) {
    case "PRESENCE_UPDATE": {
      connectedClients.set(getRaw(ws), {
        userId: intent.userId,
        displayName: intent.displayName,
        color: intent.color,
      });
      broadcast({ event: "PRESENCE_UPDATE", users: getPresenceList() });
      break;
    }

    case "CREATE_TASK": {
      if (!intent.title?.trim()) {
        send(ws, {
          event: "ACTION_REJECTED",
          intentId: intent.intentId,
          reason: "Title is required.",
        });
        return;
      }

      const task = await taskService.createTask(intent);
      broadcast({ event: "TASK_CREATED", task });
      break;
    }

    case "EDIT_TASK_TITLE": {
      if (!intent.newTitle?.trim()) {
        send(ws, {
          event: "ACTION_REJECTED",
          intentId: intent.intentId,
          reason: "Title cannot be empty.",
        });
        return;
      }

      const result = await taskService.editTaskTitle(intent);
      if (result.ok) {
        broadcast({ event: "TASK_UPDATED", task: result.task });
      } else {
        send(ws, {
          event: "ACTION_REJECTED",
          intentId: intent.intentId,
          reason: result.reason,
          serverState: result.serverState,
        });
      }
      break;
    }

    case "EDIT_TASK_DESCRIPTION": {
      const result = await taskService.editTaskDescription(intent);
      if (result.ok) {
        broadcast({ event: "TASK_UPDATED", task: result.task });
      } else {
        send(ws, {
          event: "ACTION_REJECTED",
          intentId: intent.intentId,
          reason: result.reason,
          serverState: result.serverState,
        });
      }
      break;
    }

    case "MOVE_TASK": {
      if (!validStatuses.includes(intent.newStatus)) {
        send(ws, {
          event: "ACTION_REJECTED",
          intentId: intent.intentId,
          reason: `Invalid status: ${intent.newStatus}`,
        });
        return;
      }

      const result = await taskService.moveTask(intent);
      if (result.ok) {
        broadcast({ event: "TASK_UPDATED", task: result.task });
      } else {
        send(ws, {
          event: "ACTION_REJECTED",
          intentId: intent.intentId,
          reason: result.reason,
          serverState: result.serverState,
        });
      }
      break;
    }

    case "DELETE_TASK": {
      const result = await taskService.deleteTask(intent);
      if (result.ok) {
        broadcast({ event: "TASK_DELETED", taskId: result.taskId });
      } else {
        send(ws, {
          event: "ACTION_REJECTED",
          intentId: intent.intentId,
          reason: result.reason,
          serverState: result.serverState,
        });
      }
      break;
    }

    default: {
      send(ws, {
        event: "ACTION_REJECTED",
        intentId: "unknown",
        reason: `Unknown action: ${(intent as { action: string }).action}`,
      });
    }
  }
}

export function handleClose(ws: ServerWebSocket<unknown>) {
  const raw = getRaw(ws);
  const wasRegistered = connectedClients.has(raw);
  connectedClients.delete(raw);
  // Only broadcast if this connection was in the presence map — avoids a
  // spurious PRESENCE_UPDATE when a client disconnects before sending PRESENCE_UPDATE.
  if (wasRegistered) {
    broadcast({ event: "PRESENCE_UPDATE", users: getPresenceList() });
  }
}
