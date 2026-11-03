import { useEffect } from "react";
import type { Toast } from "../hooks/useGame";

function Item({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  useEffect(() => {
    const id = setTimeout(() => onDone(toast.id), 5000);
    return () => clearTimeout(id);
  }, [toast.id, onDone]);
  return (
    <div className="toast">
      <strong>{toast.title}</strong>
      <span>{toast.plain ? toast.desc : `${toast.desc} +1% production.`}</span>
    </div>
  );
}

export function Toasts({ toasts, onDone }: { toasts: Toast[]; onDone: (id: number) => void }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.slice(-3).map((t) => (
        <Item key={t.id} toast={t} onDone={onDone} />
      ))}
    </div>
  );
}
