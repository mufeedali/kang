import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Check, GripVertical, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useKangStore } from "@/store/kang-store";
import type { Task, TaskStatus } from "@/types";
import { TaskCard } from "./task-card";

interface ColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  accentColor: string;
  previewTask?: Task | null;
  previewOverId?: string | null;
}

function DropPreview({ task }: { task: Task }) {
  return (
    <div className="rounded-xl border border-dashed border-primary/60 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-primary/40" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug break-words text-foreground/85">
            {task.title}
          </p>
          {task.description && (
            <p className="mt-2 text-xs leading-relaxed break-words text-muted-foreground line-clamp-3">
              {task.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function Column({
  status,
  title,
  tasks,
  accentColor,
  previewTask = null,
  previewOverId = null,
}: ColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const createTask = useKangStore((s) => s.createTask);

  const { setNodeRef, isOver } = useDroppable({ id: status });

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const showPreviewAtEnd =
    !!previewTask &&
    tasks.length > 0 &&
    (!previewOverId || previewOverId === status);

  const handleAdd = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    createTask(trimmed, newDescription.trim() || null, status);
    setNewTitle("");
    setNewDescription("");
    setIsAdding(false);
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setNewTitle("");
    setNewDescription("");
  };

  return (
    <div
      className={`flex flex-col rounded-xl border bg-muted/30 backdrop-blur-sm transition-colors duration-200 min-w-[320px] w-[320px] ${
        isOver ? "border-primary/50 bg-primary/5" : "border-border/50"
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <h2 className="text-sm font-semibold tracking-wide text-foreground/80">
            {title}
          </h2>
          <Badge
            variant="secondary"
            className="h-5 min-w-[20px] justify-center text-[10px] font-semibold px-1.5"
          >
            {tasks.length}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsAdding(true)}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Separator className="opacity-50 mb-3" />

      {/* Add Task Inline */}
      {isAdding && (
        <div className="px-3 pb-2">
          <div className="rounded-lg border bg-card p-2.5 space-y-2 shadow-sm">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title..."
              autoFocus
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") cancelAdd();
              }}
            />
            <Textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)..."
              className="text-sm min-h-[60px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Escape") cancelAdd();
              }}
            />
            <div className="flex gap-1 justify-end pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelAdd}
                className="h-7 px-2"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" onClick={handleAdd} className="h-7 px-2">
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Task List */}
      <ScrollArea className="flex-1">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          <div ref={setNodeRef} className="space-y-2 min-h-[40px] px-3 pb-3">
            {tasks.map((task) => (
              <div key={task.id} className="space-y-2">
                {previewTask && previewOverId === task.id && <DropPreview task={previewTask} />}
                <TaskCard task={task} />
              </div>
            ))}
            {showPreviewAtEnd && <DropPreview task={previewTask} />}
            {!tasks.length && previewTask && previewOverId === status && (
              <DropPreview task={previewTask} />
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}
