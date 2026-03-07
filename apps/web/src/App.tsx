import { useEffect } from "react";
import { Toaster } from "sonner";
import { KanbanBoard } from "@/components/board/kanban-board";
import { ErrorBoundary } from "@/components/error-boundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { syncEngine } from "@/lib/sync-engine";

export default function App() {
  useEffect(() => {
    syncEngine.connect();
    return () => {
      syncEngine.disconnect();
    };
  }, []);

  return (
    <TooltipProvider delay={200}>
      <ErrorBoundary>
        <KanbanBoard />
      </ErrorBoundary>
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{
          className: "text-sm",
        }}
      />
    </TooltipProvider>
  );
}
