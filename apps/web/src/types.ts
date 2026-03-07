// All types are derived from the backend's TypeBox schemas via re-export.
// No manual duplication — the API's contract.ts is the single source of truth.
export type {
  ActionRejectedEvent,
  BoardStateEvent,
  ClientIntent,
  CreateTaskIntent,
  DeleteTaskIntent,
  EditTaskDescriptionIntent,
  EditTaskTitleIntent,
  MoveTaskIntent,
  PresenceUpdateEvent,
  PresenceUpdateIntent,
  ServerEvent,
  Task,
  TaskCreatedEvent,
  TaskDeletedEvent,
  TaskStatus,
  TaskUpdatedEvent,
  UserInfo,
} from "../../api/src/types/index";
