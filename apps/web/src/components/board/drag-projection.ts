import { generateKeyBetween } from "fractional-indexing";
import type { Task, TaskStatus } from "@/types";

const TASK_STATUSES = ["todo", "in_progress", "done"] satisfies TaskStatus[];

export type ProjectedMove = {
  status: TaskStatus;
  rank: string;
};

type TaskNeighborIds = {
  previousTaskId: string | null;
  nextTaskId: string | null;
};

export function getColumnEndDropId(status: TaskStatus): string {
  return `${status}__end`;
}

export function getDropStatus(overId: string): TaskStatus | null {
  if (isTaskStatus(overId)) return overId;

  const status = overId.replace(/__end$/, "");
  return isTaskStatus(status) ? status : null;
}

export function sortTasksByRank(tasks: Task[]): Task[] {
  return tasks.toSorted((a, b) =>
    a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0,
  );
}

function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}

function getTaskNeighborIds(
  tasks: Task[],
  taskId: string,
): TaskNeighborIds | null {
  const index = tasks.findIndex((task) => task.id === taskId);
  if (index === -1) return null;

  return {
    previousTaskId: tasks[index - 1]?.id ?? null,
    nextTaskId: tasks[index + 1]?.id ?? null,
  };
}

function getProjectedNeighbors(
  currentTasks: Task[],
  activeTask: Task,
  overId: string,
): {
  targetStatus: TaskStatus;
  previousTaskId: string | null;
  nextTaskId: string | null;
  beforeRank: string | null;
  afterRank: string | null;
} | null {
  const overTask = currentTasks.find((task) => task.id === overId);
  const targetStatus = overTask ? overTask.status : getDropStatus(overId);

  if (!targetStatus) return null;

  const targetTasks = sortTasksByRank(
    currentTasks.filter(
      (task) => task.status === targetStatus && task.id !== activeTask.id,
    ),
  );

  if (
    !overTask ||
    overId === targetStatus ||
    overId === getColumnEndDropId(targetStatus)
  ) {
    const previousTask = targetTasks.at(-1) ?? null;

    return {
      targetStatus,
      previousTaskId: previousTask?.id ?? null,
      nextTaskId: null,
      beforeRank: previousTask?.rank ?? null,
      afterRank: null,
    };
  }

  const overIndex = targetTasks.findIndex((task) => task.id === overTask.id);
  if (overIndex === -1) return null;

  let previousTask: Task | null;
  let nextTask: Task | null;

  if (activeTask.status === targetStatus) {
    const activeTasksInTarget = sortTasksByRank(
      currentTasks.filter((task) => task.status === targetStatus),
    );
    const activeIndex = activeTasksInTarget.findIndex(
      (task) => task.id === activeTask.id,
    );
    const overTargetIndex = activeTasksInTarget.findIndex(
      (task) => task.id === overTask.id,
    );
    const isDraggingDown =
      activeIndex !== -1 &&
      overTargetIndex !== -1 &&
      activeIndex < overTargetIndex;

    if (isDraggingDown) {
      previousTask = targetTasks[overIndex] ?? null;
      nextTask = targetTasks[overIndex + 1] ?? null;
    } else {
      previousTask = overIndex > 0 ? targetTasks[overIndex - 1] : null;
      nextTask = targetTasks[overIndex] ?? null;
    }
  } else {
    previousTask = overIndex > 0 ? targetTasks[overIndex - 1] : null;
    nextTask = targetTasks[overIndex] ?? null;
  }

  return {
    targetStatus,
    previousTaskId: previousTask?.id ?? null,
    nextTaskId: nextTask?.id ?? null,
    beforeRank: previousTask?.rank ?? null,
    afterRank: nextTask?.rank ?? null,
  };
}

export function projectTaskMove(
  currentTasks: Task[],
  taskId: string,
  overId: string,
): ProjectedMove | null {
  const activeTask = currentTasks.find((task) => task.id === taskId);
  if (!activeTask) return null;

  const projectedNeighbors = getProjectedNeighbors(
    currentTasks,
    activeTask,
    overId,
  );
  if (!projectedNeighbors) return null;

  if (projectedNeighbors.targetStatus === activeTask.status) {
    const activeColumnTasks = sortTasksByRank(
      currentTasks.filter((task) => task.status === activeTask.status),
    );
    const currentNeighbors = getTaskNeighborIds(
      activeColumnTasks,
      activeTask.id,
    );

    if (
      currentNeighbors &&
      currentNeighbors.previousTaskId === projectedNeighbors.previousTaskId &&
      currentNeighbors.nextTaskId === projectedNeighbors.nextTaskId
    ) {
      return null;
    }
  }

  return {
    status: projectedNeighbors.targetStatus,
    rank: generateKeyBetween(
      projectedNeighbors.beforeRank,
      projectedNeighbors.afterRank,
    ),
  };
}
