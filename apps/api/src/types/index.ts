import type { Static } from "elysia";
import { t } from "elysia";

// ── Shared scalars ──────────────────────────────────────────────────────────

export const TaskStatusSchema = t.Union([
  t.Literal("todo"),
  t.Literal("in_progress"),
  t.Literal("done"),
]);
export type TaskStatus = Static<typeof TaskStatusSchema>;

export const TaskSchema = t.Object({
  id: t.String(),
  title: t.String(),
  description: t.Union([t.String(), t.Null()]),
  status: TaskStatusSchema,
  rank: t.String(),
  titleVersion: t.Number(),
  descriptionVersion: t.Number(),
  positionVersion: t.Number(),
  createdAt: t.String(),
  updatedAt: t.String(),
  deletedAt: t.Union([t.String(), t.Null()]),
});
export type Task = Static<typeof TaskSchema>;

export const UserInfoSchema = t.Object({
  userId: t.String(),
  displayName: t.String(),
  color: t.String(),
});
export type UserInfo = Static<typeof UserInfoSchema>;

// ── Client → Server (Action Intents) ──────────────────────────────────────

export const CreateTaskIntentSchema = t.Object({
  action: t.Literal("CREATE_TASK"),
  intentId: t.String(),
  title: t.String(),
  description: t.Union([t.String(), t.Null()]),
  status: TaskStatusSchema,
  rank: t.String(),
});

export const EditTaskTitleIntentSchema = t.Object({
  action: t.Literal("EDIT_TASK_TITLE"),
  intentId: t.String(),
  taskId: t.String(),
  newTitle: t.String(),
  baseTitleVersion: t.Number(),
});

export const EditTaskDescriptionIntentSchema = t.Object({
  action: t.Literal("EDIT_TASK_DESCRIPTION"),
  intentId: t.String(),
  taskId: t.String(),
  newDescription: t.String(),
  baseDescriptionVersion: t.Number(),
});

export const MoveTaskIntentSchema = t.Object({
  action: t.Literal("MOVE_TASK"),
  intentId: t.String(),
  taskId: t.String(),
  newStatus: TaskStatusSchema,
  newRank: t.String(),
  basePositionVersion: t.Number(),
});

export const DeleteTaskIntentSchema = t.Object({
  action: t.Literal("DELETE_TASK"),
  intentId: t.String(),
  taskId: t.String(),
});

export const PresenceUpdateIntentSchema = t.Object({
  action: t.Literal("PRESENCE_UPDATE"),
  userId: t.String(),
  displayName: t.String(),
  color: t.String(),
});

export const ClientIntentSchema = t.Union([
  CreateTaskIntentSchema,
  EditTaskTitleIntentSchema,
  EditTaskDescriptionIntentSchema,
  MoveTaskIntentSchema,
  DeleteTaskIntentSchema,
  PresenceUpdateIntentSchema,
]);

export type CreateTaskIntent = Static<typeof CreateTaskIntentSchema>;
export type EditTaskTitleIntent = Static<typeof EditTaskTitleIntentSchema>;
export type EditTaskDescriptionIntent = Static<
  typeof EditTaskDescriptionIntentSchema
>;
export type MoveTaskIntent = Static<typeof MoveTaskIntentSchema>;
export type DeleteTaskIntent = Static<typeof DeleteTaskIntentSchema>;
export type PresenceUpdateIntent = Static<typeof PresenceUpdateIntentSchema>;
export type ClientIntent = Static<typeof ClientIntentSchema>;

// ── Server → Client (Events) ──────────────────────────────────────────────

export const BoardStateEventSchema = t.Object({
  event: t.Literal("BOARD_STATE"),
  tasks: t.Array(TaskSchema),
  users: t.Array(UserInfoSchema),
});

export const TaskCreatedEventSchema = t.Object({
  event: t.Literal("TASK_CREATED"),
  task: TaskSchema,
  actorId: t.Optional(t.String()),
  actorName: t.Optional(t.String()),
});

export const TaskUpdatedEventSchema = t.Object({
  event: t.Literal("TASK_UPDATED"),
  task: TaskSchema,
  actorId: t.Optional(t.String()),
  actorName: t.Optional(t.String()),
});

export const TaskDeletedEventSchema = t.Object({
  event: t.Literal("TASK_DELETED"),
  taskId: t.String(),
  actorId: t.Optional(t.String()),
  actorName: t.Optional(t.String()),
});

export const ActionRejectedEventSchema = t.Object({
  event: t.Literal("ACTION_REJECTED"),
  intentId: t.String(),
  reason: t.String(),
  serverState: t.Optional(TaskSchema),
});

export const PresenceUpdateEventSchema = t.Object({
  event: t.Literal("PRESENCE_UPDATE"),
  users: t.Array(UserInfoSchema),
});

export const ServerEventSchema = t.Union([
  BoardStateEventSchema,
  TaskCreatedEventSchema,
  TaskUpdatedEventSchema,
  TaskDeletedEventSchema,
  ActionRejectedEventSchema,
  PresenceUpdateEventSchema,
]);

export type BoardStateEvent = Static<typeof BoardStateEventSchema>;
export type TaskCreatedEvent = Static<typeof TaskCreatedEventSchema>;
export type TaskUpdatedEvent = Static<typeof TaskUpdatedEventSchema>;
export type TaskDeletedEvent = Static<typeof TaskDeletedEventSchema>;
export type ActionRejectedEvent = Static<typeof ActionRejectedEventSchema>;
export type PresenceUpdateEvent = Static<typeof PresenceUpdateEventSchema>;
export type ServerEvent = Static<typeof ServerEventSchema>;
