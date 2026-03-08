import { generateKeyBetween } from "fractional-indexing";
import { create } from "zustand";
import { syncEngine } from "@/lib/sync-engine";
import { getOrCreateUser } from "@/lib/user";
import type { Task, TaskStatus, UserInfo } from "@/types";

interface KangState {
  // Data
  tasks: Task[];
  users: UserInfo[];
  currentUser: UserInfo;

  // Connection
  isBrowserOnline: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  offlineQueueLength: number;

  // UI state
  editingTaskId: string | null;
  setEditingTaskId: (id: string | null) => void;

  // Task actions (optimistic)
  createTask: (
    title: string,
    description: string | null,
    status: TaskStatus,
  ) => void;
  editTaskTitle: (taskId: string, newTitle: string) => void;
  editTaskDescription: (taskId: string, newDescription: string) => void;
  moveTask: (taskId: string, newStatus: TaskStatus, newRank: string) => void;
  deleteTask: (taskId: string) => void;
}

export function upsertTask(tasks: Task[], nextTask: Task): Task[] {
  return tasks.some((task) => task.id === nextTask.id)
    ? tasks.map((task) => (task.id === nextTask.id ? nextTask : task))
    : [...tasks, nextTask];
}

export function updateTask(
  tasks: Task[],
  taskId: string,
  updater: (task: Task) => Task,
): Task[] {
  return tasks.map((task) => (task.id === taskId ? updater(task) : task));
}

export const useKangStore = create<KangState>((set, get) => ({
  tasks: [],
  users: [],
  currentUser: getOrCreateUser(),
  isBrowserOnline: typeof navigator === "undefined" ? true : navigator.onLine,
  isConnecting: false,
  isConnected: false,
  offlineQueueLength: 0,

  editingTaskId: null,
  setEditingTaskId: (id) => set({ editingTaskId: id }),

  createTask: (title, description, status) => {
    const { tasks } = get();

    // Generate a rank at the top of the column
    const columnTasks = tasks
      .filter((t) => t.status === status)
      .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));

    const firstRank = columnTasks[0]?.rank ?? null;
    const newRank = generateKeyBetween(null, firstRank);

    const intentId = crypto.randomUUID();
    const timestamp = Date.now();

    // Optimistic: add a temporary task (intentId as placeholder ID)
    const optimisticTask: Task = {
      id: intentId,
      title,
      description,
      status,
      rank: newRank,
      titleVersion: 0,
      descriptionVersion: 0,
      positionVersion: 0,
      createdAt: new Date(timestamp).toISOString(),
      updatedAt: new Date(timestamp).toISOString(),
      deletedAt: null,
    };

    set((state) => ({ tasks: [...state.tasks, optimisticTask] }));

    syncEngine.sendIntent({
      action: "CREATE_TASK",
      intentId,
      title,
      description,
      status,
      rank: newRank,
    });
  },

  editTaskTitle: (taskId, newTitle) => {
    const existingTask = get().tasks.find((task) => task.id === taskId);
    if (!existingTask) return;

    const intentId = crypto.randomUUID();
    const timestamp = Date.now();

    set((state) => ({
      tasks: updateTask(state.tasks, taskId, (task) => ({
        ...task,
        title: newTitle,
        titleVersion: task.titleVersion + 1,
        updatedAt: new Date(timestamp).toISOString(),
      })),
    }));

    syncEngine.sendIntent({
      action: "EDIT_TASK_TITLE",
      intentId,
      taskId,
      newTitle,
      baseTitleVersion: existingTask.titleVersion,
    });
  },

  editTaskDescription: (taskId, newDescription) => {
    const existingTask = get().tasks.find((task) => task.id === taskId);
    if (!existingTask) return;

    const intentId = crypto.randomUUID();
    const timestamp = Date.now();

    set((state) => ({
      tasks: updateTask(state.tasks, taskId, (task) => ({
        ...task,
        description: newDescription,
        descriptionVersion: task.descriptionVersion + 1,
        updatedAt: new Date(timestamp).toISOString(),
      })),
    }));

    syncEngine.sendIntent({
      action: "EDIT_TASK_DESCRIPTION",
      intentId,
      taskId,
      newDescription,
      baseDescriptionVersion: existingTask.descriptionVersion,
    });
  },

  moveTask: (taskId, newStatus, newRank) => {
    const existingTask = get().tasks.find((task) => task.id === taskId);
    if (!existingTask) return;

    const intentId = crypto.randomUUID();
    const timestamp = Date.now();

    set((state) => ({
      tasks: updateTask(state.tasks, taskId, (task) => ({
        ...task,
        status: newStatus,
        rank: newRank,
        positionVersion: task.positionVersion + 1,
        updatedAt: new Date(timestamp).toISOString(),
      })),
    }));

    syncEngine.sendIntent({
      action: "MOVE_TASK",
      intentId,
      taskId,
      newStatus,
      newRank,
      basePositionVersion: existingTask.positionVersion,
    });
  },

  deleteTask: (taskId) => {
    const intentId = crypto.randomUUID();

    // Optimistic: remove immediately
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    }));

    syncEngine.sendIntent({
      action: "DELETE_TASK",
      intentId,
      taskId,
    });
  },
}));
