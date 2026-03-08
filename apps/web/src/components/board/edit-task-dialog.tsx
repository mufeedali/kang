import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useKangStore } from "@/store/kang-store";
import type { Task } from "@/types";

type EditTaskFormProps = {
  task: Task;
  onSave: (newTitle: string, newDescription: string) => void;
};

function EditTaskForm({ task, onSave }: EditTaskFormProps) {
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(
    task.description ?? "",
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(editTitle, editDescription);
      }}
    >
      <div className="space-y-4 pt-2 pb-4">
        <div className="space-y-2">
          <label htmlFor="edit-title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="edit-title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Task title..."
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="edit-desc" className="text-sm font-medium">
            Description
          </label>
          <Textarea
            id="edit-desc"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Description (optional)..."
            className="min-h-25 resize-none"
          />
        </div>
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit">Save Changes</Button>
      </DialogFooter>
    </form>
  );
}

export function EditTaskDialog() {
  const editingTaskId = useKangStore((s) => s.editingTaskId);
  const setEditingTaskId = useKangStore((s) => s.setEditingTaskId);
  const tasks = useKangStore((s) => s.tasks);
  const editTaskTitle = useKangStore((s) => s.editTaskTitle);
  const editTaskDescription = useKangStore((s) => s.editTaskDescription);

  const task = tasks.find((t) => t.id === editingTaskId) ?? null;

  const handleSave = (newTitle: string, newDescription: string) => {
    if (!task) return;
    const nextTitle = newTitle.trim();
    if (!nextTitle) return;

    if (nextTitle !== task.title) {
      editTaskTitle(task.id, nextTitle);
    }

    const nextDescription = newDescription.trim();
    if (nextDescription !== (task.description ?? "")) {
      editTaskDescription(task.id, nextDescription);
    }

    setEditingTaskId(null);
  };

  return (
    <Dialog
      open={editingTaskId !== null}
      onOpenChange={(open) => {
        if (!open) setEditingTaskId(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        {task && (
          // Keyed by task id so local form state resets when editing a different task.
          <EditTaskForm key={task.id} task={task} onSave={handleSave} />
        )}
      </DialogContent>
    </Dialog>
  );
}
