import { useLayoutEffect, useRef, type RefObject } from "react";

const dialogs: HTMLElement[] = [];
const controls = 'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';
const available = (element: HTMLElement) => !element.closest('[inert], [hidden], [aria-hidden="true"]') && element.getClientRects().length > 0;

export function useModalDialog<T extends HTMLElement>(ref: RefObject<T | null>, onClose: () => void, open = true) {
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!open || !panel) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogs.push(panel);
    const first = () => Array.from(panel.querySelectorAll<HTMLElement>(controls)).filter(available)[0] ?? panel;
    // Focus a close control instead of opening a mobile keyboard automatically.
    (panel.querySelector<HTMLElement>('button[aria-label^="Закрыть"]') ?? first()).focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (dialogs.at(-1) !== panel || event.defaultPrevented) return;
      if (event.key === "Escape") {
        // Let the nested calendar/select consume Escape before its parent dialog.
        if ((event.target as Element)?.closest?.(".site-date.is-open, .site-select.is-open")) return;
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(controls)).filter(available);
      const target = document.activeElement;
      if (!items.length) { event.preventDefault(); panel.focus({ preventScroll: true }); }
      else if (event.shiftKey && (target === items[0] || !panel.contains(target))) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && (target === items.at(-1) || !panel.contains(target))) { event.preventDefault(); items[0].focus(); }
    };
    const onFocus = (event: FocusEvent) => {
      if (dialogs.at(-1) === panel && !panel.contains(event.target as Node)) first().focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      const index = dialogs.indexOf(panel);
      if (index >= 0) dialogs.splice(index, 1);
      requestAnimationFrame(() => {
        const next = dialogs.at(-1);
        if (next?.contains(document.activeElement)) return;
        if (previous?.isConnected && available(previous) && (!next || next.contains(previous))) previous.focus({ preventScroll: true });
        else if (next) next.querySelector<HTMLElement>(controls)?.focus({ preventScroll: true });
        else document.querySelector<HTMLElement>(".site-header button, .site-header a")?.focus({ preventScroll: true });
      });
    };
  }, [ref, open]);
}
