import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useKangStore } from "@/store/kang-store";
import type { Task } from "@/types";

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const setEditingTaskId = useKangStore((s) => s.setEditingTaskId);
  const deleteTask = useKangStore((s) => s.deleteTask);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      id={`task-${task.id}`}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative ring-0 border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200 hover:border-border gap-0 cursor-grab active:cursor-grabbing"
    >
      <CardHeader
        className={`p-3 ${task.description ? "pb-1" : ""} flex flex-row items-start gap-2`}
      >
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/30" />
        <h3 className="text-sm font-medium leading-snug flex-1 break-words">
          {task.title}
        </h3>

        {/* DropdownMenu for task actions */}
        <DropdownMenu>
          <DropdownMenuTrigger className="h-6 w-6 p-0 inline-flex items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent hover:text-accent-foreground">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => setEditingTaskId(task.id)}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => deleteTask(task.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      {task.description && (
        <CardContent className="p-3 pt-0 pl-9">
          <p className="text-xs text-muted-foreground leading-relaxed break-words line-clamp-3">
            {task.description}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
