import { useEffect, useState } from "react";
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

export function EditTaskDialog() {
  const editingTaskId = useKangStore((s) => s.editingTaskId);
  const setEditingTaskId = useKangStore((s) => s.setEditingTaskId);
  const tasks = useKangStore((s) => s.tasks);
  const editTaskTitle = useKangStore((s) => s.editTaskTitle);
  const editTaskDescription = useKangStore((s) => s.editTaskDescription);

  const task = tasks.find((t) => t.id === editingTaskId) ?? null;

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Sync local form state when the dialog opens for a task
  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description ?? "");
    }
  }, [task]); // intentionally only on id change, not every task update

  const handleSave = () => {
    if (!task) return;
    const newTitle = editTitle.trim();
    if (!newTitle) return;

    if (newTitle !== task.title) {
      editTaskTitle(task.id, newTitle);
    }
    if (editDescription.trim() !== (task.description ?? "")) {
      editTaskDescription(task.id, editDescription.trim());
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
        <div className="space-y-4 py-2">
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
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
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
              className="min-h-[100px] resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
