import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type SiteSelectOption = {
  value: string | number;
  label: string;
  disabled?: boolean;
};

type Props = {
  value: string | number;
  options: SiteSelectOption[];
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  className?: string;
};

export default function SiteSelect({ value, options, onChange, id, ariaLabel, className = "" }: Props) {
  const generatedId = useId();
  const controlId = id ?? `site-select-${generatedId}`;
  const listId = `${controlId}-list`;
  const root = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => String(option.value) === String(value)));
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(selectedIndex);
  const selected = options[selectedIndex] ?? options[0];

  useEffect(() => setHighlighted(selectedIndex), [selectedIndex]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [open]);

  const move = (direction: 1 | -1) => {
    let next = highlighted;
    do { next = (next + direction + options.length) % options.length; }
    while (options[next]?.disabled && next !== highlighted);
    setHighlighted(next);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(String(option.value));
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      else move(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" && open) { event.preventDefault(); setHighlighted(0); return; }
    if (event.key === "End" && open) { event.preventDefault(); setHighlighted(options.length - 1); return; }
    if ((event.key === "Enter" || event.key === " ") && open) { event.preventDefault(); choose(highlighted); return; }
    if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); }
    if (event.key === "Tab") setOpen(false);
  };

  return <div ref={root} className={`site-select ${open ? "is-open" : ""} ${className}`}>
    <button
      id={controlId}
      type="button"
      role="combobox"
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-controls={listId}
      aria-haspopup="listbox"
      aria-activedescendant={open ? `${listId}-${highlighted}` : undefined}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={handleKeyDown}
      className="site-select-trigger"
    >
      <span>{selected?.label ?? "Выберите значение"}</span>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m7 10 5 5 5-5"/></svg>
    </button>
    {open ? <ul id={listId} role="listbox" aria-labelledby={controlId} className="site-select-menu">
      {options.map((option, index) => <li key={`${option.value}-${index}`}>
        <button
          id={`${listId}-${index}`}
          type="button"
          role="option"
          aria-selected={String(option.value) === String(value)}
          disabled={option.disabled}
          tabIndex={-1}
          onMouseEnter={() => setHighlighted(index)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => choose(index)}
          className={highlighted === index ? "is-highlighted" : ""}
        >
          <span>{option.label}</span>
          {String(option.value) === String(value) ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="m5 12 4 4L19 6"/></svg> : null}
        </button>
      </li>)}
    </ul> : null}
  </div>;
}
