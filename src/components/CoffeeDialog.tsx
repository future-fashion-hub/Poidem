import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import CloseRounded from "@mui/icons-material/CloseRounded";
import LocalCafeOutlined from "@mui/icons-material/LocalCafeOutlined";
import { useModalDialog } from "./useModalDialog";
import { usePopupDismiss } from "./usePopupDismiss";

type Props = { title: string; onClose: () => void; busy?: boolean; dirty?: boolean; children: (dismiss: () => void) => ReactNode };
export default function CoffeeDialog({ title, onClose, busy = false, dirty = false, children }: Props) {
  const panel = useRef<HTMLElement>(null);
  const { closing, dismiss } = usePopupDismiss(onClose, true, { busy, dirty });
  useModalDialog(panel, dismiss);
  return createPortal(<div className="coffee-overlay" data-closing={closing || undefined} onMouseDown={event => { if (event.target === event.currentTarget) dismiss(); }}>
    <section ref={panel} className="coffee-dialog" role="dialog" aria-modal="true" aria-labelledby="coffee-dialog-title" tabIndex={-1}>
      <header className="coffee-dialog-header"><span className="coffee-icon"><LocalCafeOutlined aria-hidden="true"/></span><div><p className="coffee-eyebrow">Кофе — это повод</p><h2 id="coffee-dialog-title">{title}</h2></div><button type="button" onClick={dismiss} disabled={busy} className="coffee-icon-button" aria-label="Закрыть кофе-тайм"><CloseRounded/></button></header>
      {children(dismiss)}
    </section>
  </div>, document.body);
}
