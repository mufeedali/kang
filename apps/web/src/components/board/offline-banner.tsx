import { Loader2, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useKangStore } from "@/store/kang-store";

export function OfflineBanner() {
  const isConnected = useKangStore((s) => s.isConnected);
  const isConnecting = useKangStore((s) => s.isConnecting);
  const queueLength = useKangStore((s) => s.offlineQueueLength);

  const [show, setShow] = useState(false);
  const connectedOnce = useRef(false);

  useEffect(() => {
    if (isConnected) {
      connectedOnce.current = true;
      setShow(false);
      return;
    }
    if (!connectedOnce.current) return;
    const timer = setTimeout(() => setShow(true), 1000);
    return () => clearTimeout(timer);
  }, [isConnected]);

  if (isConnected || !show) return null;

  if (isConnecting) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/95 text-amber-950 px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg backdrop-blur-sm animate-in slide-in-from-top duration-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Reconnecting to server...</span>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/95 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg backdrop-blur-sm animate-in slide-in-from-top duration-300">
      <WifiOff className="h-4 w-4" />
      <span>
        You're offline. Changes will sync when reconnected.
        {queueLength > 0 && (
          <span className="ml-1 font-semibold">
            ({queueLength} pending {queueLength === 1 ? "action" : "actions"})
          </span>
        )}
      </span>
    </div>
  );
}
