import {
  closestCorners,
  type DragCancelEvent,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { generateKeyBetween } from "fractional-indexing";
import { Kanban } from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { useKangStore } from "@/store/kang-store";
import type { Task, TaskStatus } from "@/types";
import { Column } from "./column";
import { EditTaskDialog } from "./edit-task-dialog";
import { OfflineBanner } from "./offline-banner";
import { PresenceIndicator } from "./presence-indicator";
import { TaskCardPreview } from "./task-card";

const COLUMNS: { status: TaskStatus; title: string; color: string }[] = [
  { status: "todo", title: "To Do", color: "#3B82F6" },
  { status: "in_progress", title: "In Progress", color: "#F59E0B" },
  { status: "done", title: "Done", color: "#22C55E" },
];

const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

type ProjectedMove = {
  status: TaskStatus;
  rank: string;
};

type DragPreview = {
  task: Task;
  status: TaskStatus;
  overId: string;
};

function sortTasksByRank(tasks: Task[]): Task[] {
  return tasks.toSorted((a, b) =>
    a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0,
  );
}

function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}

function groupTasksByColumn(tasks: Task[]): Record<TaskStatus, Task[]> {
  const grouped: Record<TaskStatus, Task[]> = {
    todo: [],
    in_progress: [],
    done: [],
  };

  for (const task of tasks) {
    grouped[task.status].push(task);
  }

  for (const status of TASK_STATUSES) {
    grouped[status] = sortTasksByRank(grouped[status]);
  }

  return grouped;
}

function projectTaskMove(
  currentTasks: Task[],
  taskId: string,
  overId: string,
): ProjectedMove | null {
  const overTask = currentTasks.find((task) => task.id === overId);
  const targetStatus = overTask
    ? overTask.status
    : isTaskStatus(overId)
      ? overId
      : null;

  if (!targetStatus) return null;

  const currentActiveTask = currentTasks.find((task) => task.id === taskId);
  if (!currentActiveTask) return null;
  const activeStatus = currentActiveTask.status;

  const targetTasks = sortTasksByRank(
    currentTasks.filter(
      (task) => task.status === targetStatus && task.id !== taskId,
    ),
  );

  if (!overTask || overId === targetStatus) {
    return {
      status: targetStatus,
      rank: generateKeyBetween(targetTasks.at(-1)?.rank ?? null, null),
    };
  }

  const overIndex = targetTasks.findIndex((task) => task.id === overTask.id);
  if (overIndex === -1) return null;

  let before: string | null;
  let after: string | null;

  if (activeStatus === targetStatus) {
    const activeTasksInTarget = sortTasksByRank(
      currentTasks.filter((task) => task.status === targetStatus),
    );
    const activeIndex = activeTasksInTarget.findIndex(
      (task) => task.id === taskId,
    );
    const overTargetIndex = activeTasksInTarget.findIndex(
      (task) => task.id === overTask.id,
    );
    const isDraggingDown =
      activeIndex !== -1 &&
      overTargetIndex !== -1 &&
      activeIndex < overTargetIndex;

    if (isDraggingDown) {
      before = targetTasks[overIndex]?.rank ?? null;
      after = targetTasks[overIndex + 1]?.rank ?? null;
    } else {
      before = overIndex > 0 ? targetTasks[overIndex - 1].rank : null;
      after = targetTasks[overIndex]?.rank ?? null;
    }
  } else {
    before = overIndex > 0 ? targetTasks[overIndex - 1].rank : null;
    after = targetTasks[overIndex]?.rank ?? null;
  }

  return {
    status: targetStatus,
    rank: generateKeyBetween(before, after),
  };
}

export function KanbanBoard() {
  const storeTasks = useKangStore((s) => s.tasks);
  const moveTask = useKangStore((s) => s.moveTask);
  const isConnected = useKangStore((s) => s.isConnected);
  const isConnecting = useKangStore((s) => s.isConnecting);

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const dragPreview = useMemo<DragPreview | null>(() => {
    if (!activeTask || !overId) return null;

    const projected = projectTaskMove(storeTasks, activeTask.id, overId);
    if (!projected || projected.status === activeTask.status) {
      return null;
    }

    return {
      task: activeTask,
      status: projected.status,
      overId,
    };
  }, [activeTask, overId, storeTasks]);

  const tasksByColumn = useMemo(
    () => groupTasksByColumn(storeTasks),
    [storeTasks],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = storeTasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
      setOverId(task.id);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveTask(null);
    setOverId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const originalTask = activeTask;

    setActiveTask(null);
    setOverId(null);

    if (!over || !originalTask) return;

    const taskId = active.id as string;
    const projected = projectTaskMove(storeTasks, taskId, over.id as string);
    if (!projected) return;

    if (
      projected.status === originalTask.status &&
      projected.rank === originalTask.rank
    ) {
      return;
    }

    moveTask(taskId, projected.status, projected.rank);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <OfflineBanner />

      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Kanban className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">Kang</h1>
            <p className="text-xs text-muted-foreground">
              Multiplayer Kanban Board
            </p>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  isConnected
                    ? "bg-green-500 animate-pulse"
                    : isConnecting
                      ? "bg-amber-500 animate-pulse"
                      : "bg-red-500"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                {isConnected
                  ? "Connected"
                  : isConnecting
                    ? "Connecting..."
                    : "Disconnected"}
              </span>
            </div>
            <PresenceIndicator />
          </div>
        </div>
      </header>

      {/* Board */}
      <main className="max-w-[1400px] mx-auto p-6">
        <ErrorBoundary
          fallback={
            <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
              The board crashed. Please refresh the page.
            </div>
          }
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {COLUMNS.map((col) => (
                <Column
                  key={col.status}
                  status={col.status}
                  title={col.title}
                  tasks={tasksByColumn[col.status]}
                  accentColor={col.color}
                  previewTask={
                    dragPreview?.status === col.status ? dragPreview.task : null
                  }
                  previewOverId={
                    dragPreview?.status === col.status ? dragPreview.overId : null
                  }
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask && (
                <TaskCardPreview
                  task={activeTask}
                  className="rotate-2 opacity-90 w-[320px] shadow-2xl"
                />
              )}
            </DragOverlay>
          </DndContext>
        </ErrorBoundary>
      </main>

      <EditTaskDialog />
    </div>
  );
}
