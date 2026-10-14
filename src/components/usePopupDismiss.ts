import { useCallback, useEffect, useRef, useState } from "react";

// Keep the popup mounted (and the page locked) until its exit finishes.
export function usePopupDismiss(onDismiss: () => void, open = true) {
  const [closing, setClosing] = useState(false);
  const callback = useRef(onDismiss);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { callback.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    if (!open) {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      pending.current = false;
      setClosing(false);
    }
  }, [open]);
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);
  const dismiss = useCallback(() => {
    if (pending.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { callback.current(); return; }
    pending.current = true;
    setClosing(true);
    timer.current = setTimeout(() => { timer.current = null; callback.current(); }, 340);
  }, []);
  return { closing, dismiss };
}
