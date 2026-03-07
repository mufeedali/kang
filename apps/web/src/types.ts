// Shared types for the Action Intent protocol and server events.

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  rank: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface UserInfo {
  userId: string;
  displayName: string;
  color: string;
}

// ── Client → Server (Action Intents) ──────────────────────────────────

export interface CreateTaskIntent {
  action: "CREATE_TASK";
  intentId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  rank: string;
  timestamp: number;
}

export interface EditTaskTitleIntent {
  action: "EDIT_TASK_TITLE";
  intentId: string;
  taskId: string;
  newTitle: string;
  timestamp: number;
}

export interface EditTaskDescriptionIntent {
  action: "EDIT_TASK_DESCRIPTION";
  intentId: string;
  taskId: string;
  newDescription: string;
  timestamp: number;
}

export interface MoveTaskIntent {
  action: "MOVE_TASK";
  intentId: string;
  taskId: string;
  newStatus: TaskStatus;
  newRank: string;
  timestamp: number;
}

export interface DeleteTaskIntent {
  action: "DELETE_TASK";
  intentId: string;
  taskId: string;
  timestamp: number;
}

export interface PresenceUpdateIntent {
  action: "PRESENCE_UPDATE";
  userId: string;
  displayName: string;
  color: string;
}

export type ClientIntent =
  | CreateTaskIntent
  | EditTaskTitleIntent
  | EditTaskDescriptionIntent
  | MoveTaskIntent
  | DeleteTaskIntent
  | PresenceUpdateIntent;

// ── Server → Client (Events) ──────────────────────────────────────────

export interface BoardStateEvent {
  event: "BOARD_STATE";
  tasks: Task[];
  users: UserInfo[];
}

export interface TaskCreatedEvent {
  event: "TASK_CREATED";
  task: Task;
}

export interface TaskUpdatedEvent {
  event: "TASK_UPDATED";
  task: Task;
}

export interface TaskDeletedEvent {
  event: "TASK_DELETED";
  taskId: string;
}

export interface ActionRejectedEvent {
  event: "ACTION_REJECTED";
  intentId: string;
  reason: string;
  serverState?: Task;
}

export interface PresenceUpdateEvent {
  event: "PRESENCE_UPDATE";
  users: UserInfo[];
}

export type ServerEvent =
  | BoardStateEvent
  | TaskCreatedEvent
  | TaskUpdatedEvent
  | TaskDeletedEvent
  | ActionRejectedEvent
  | PresenceUpdateEvent;
