import { toast } from "sonner";
import { upsertTask, useKangStore } from "@/store/kang-store";
import type { ClientIntent, ServerEvent, Task } from "@/types";
import { wsClient } from "./ws-client";

const QUEUE_KEY = "kang-offline-queue";

class SyncEngine {
  private pendingIntents = new Map<
    string,
    { intent: ClientIntent; taskTitle: string | null }
  >();
  private offlineQueue: ClientIntent[] = [];

  constructor() {
    this.loadQueue();

    wsClient.setHandlers(
      this.handleServerEvent.bind(this),
      (isConnecting, isConnected) => {
        useKangStore.setState({ isConnecting, isConnected });
      },
      this.onConnected.bind(this),
    );
  }

  connect() {
    wsClient.connect();
  }

  disconnect() {
    wsClient.disconnect();
  }

  private loadQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      this.offlineQueue = raw ? JSON.parse(raw) : [];
      // Defer updating the store to avoid circular dependency execution order issues
      setTimeout(() => {
        useKangStore.setState({ offlineQueueLength: this.offlineQueue.length });
      }, 0);
    } catch {
      this.offlineQueue = [];
      setTimeout(() => {
        useKangStore.setState({ offlineQueueLength: 0 });
      }, 0);
    }
  }

  private saveQueue() {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(this.offlineQueue));
    useKangStore.setState({ offlineQueueLength: this.offlineQueue.length });
  }

  private getTaskTitleForIntent(
    tasks: Task[],
    intent: ClientIntent,
  ): string | null {
    if ("taskId" in intent) {
      return tasks.find((task) => task.id === intent.taskId)?.title ?? null;
    }
    return intent.action === "CREATE_TASK" ? intent.title : null;
  }

  private cachePendingIntent(intent: ClientIntent) {
    if (!("intentId" in intent)) return;

    this.pendingIntents.set(intent.intentId, {
      intent,
      taskTitle: this.getTaskTitleForIntent(
        useKangStore.getState().tasks,
        intent,
      ),
    });
  }

  private onConnected() {
    const { currentUser } = useKangStore.getState();

    wsClient.send({
      action: "PRESENCE_UPDATE",
      userId: currentUser.userId,
      displayName: currentUser.displayName,
      color: currentUser.color,
    });

    this.replayOfflineQueue();
  }

  sendIntent(intent: ClientIntent) {
    this.cachePendingIntent(intent);

    const sent = wsClient.send(intent);
    if (!sent) {
      this.offlineQueue.push(intent);
      this.saveQueue();
    }
  }

  private replayOfflineQueue() {
    if (this.offlineQueue.length === 0) return;

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    this.saveQueue();

    for (const intent of queue) {
      this.cachePendingIntent(intent);
      wsClient.send(intent);
    }
  }

  private showRejectionToast(
    intent: ClientIntent | undefined,
    taskTitle: string | null,
    event: Extract<ServerEvent, { event: "ACTION_REJECTED" }>,
  ) {
    const STATUS_LABELS: Record<string, string> = {
      todo: "To Do",
      in_progress: "In Progress",
      done: "Done",
    };

    const title = event.serverState?.title ?? taskTitle;
    const t = title ? `"${title}"` : "This task";
    const wasDeleted = event.reason.toLowerCase().includes("deleted");

    switch (intent?.action) {
      case "MOVE_TASK":
        if (wasDeleted) {
          toast.error(`${t} was deleted by another user.`);
        } else if (event.serverState) {
          const col =
            STATUS_LABELS[event.serverState.status] ?? event.serverState.status;
          toast.error(`${t} was moved to "${col}" by another user.`);
        } else {
          toast.error(`${t}: your move was overridden by another user.`);
        }
        break;

      case "EDIT_TASK_TITLE":
        if (wasDeleted) {
          toast.error(`${t} was deleted. Your title edit was not saved.`);
        } else {
          toast.error(
            `${t}: your title edit was overwritten by a newer change.`,
          );
        }
        break;

      case "EDIT_TASK_DESCRIPTION":
        if (wasDeleted) {
          toast.error(`${t} was deleted. Your edit was not saved.`);
        } else {
          toast.error(
            `${t}: your description edit was overwritten by a newer change.`,
          );
        }
        break;

      case "CREATE_TASK":
        toast.error(`Failed to create task: ${event.reason}`);
        break;

      case "DELETE_TASK":
        toast.error(`${t}: could not be deleted. ${event.reason}`);
        break;

      default:
        toast.error(event.reason);
    }
  }

  private handleServerEvent(event: ServerEvent) {
    switch (event.event) {
      case "BOARD_STATE":
        this.pendingIntents.clear();
        useKangStore.setState({ tasks: event.tasks, users: event.users });
        break;

      case "TASK_CREATED":
      case "TASK_UPDATED":
        useKangStore.setState((state) => ({
          tasks: upsertTask(state.tasks, event.task),
        }));
        break;

      case "TASK_DELETED":
        useKangStore.setState((state) => ({
          tasks: state.tasks.filter((t) => t.id !== event.taskId),
        }));
        break;

      case "ACTION_REJECTED": {
        const entry = this.pendingIntents.get(event.intentId);
        this.pendingIntents.delete(event.intentId);

        if (event.serverState) {
          const serverState = event.serverState;
          useKangStore.setState((state) => ({
            tasks: upsertTask(state.tasks, serverState),
          }));
        } else if (entry?.intent.action === "CREATE_TASK") {
          // Roll back the optimistic task (its id was the intentId)
          useKangStore.setState((state) => ({
            tasks: state.tasks.filter((t) => t.id !== event.intentId),
          }));
        }

        this.showRejectionToast(entry?.intent, entry?.taskTitle ?? null, event);
        break;
      }

      case "PRESENCE_UPDATE":
        useKangStore.setState({ users: event.users });
        break;
    }
  }
}

export const syncEngine = new SyncEngine();
