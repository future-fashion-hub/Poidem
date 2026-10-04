import { useEffect, useMemo, useRef, useState } from "react";
import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { DictionaryItem, Event } from "../api/types";

type FeedAction = "skip" | "save";
type Props = { events: Event[]; categories: DictionaryItem[]; cities: DictionaryItem[]; onOpen: (event: Event) => void };
type ActionRecord = Record<number, FeedAction>;
const storageKey = "poidem-event-feed-actions";

function readActions(): ActionRecord {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, action]) => action === "skip" || action === "save")) as ActionRecord;
  } catch { return {}; }
}
function saveActions(next: ActionRecord) {
  try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the current session usable when storage is unavailable. */ }
}
function FeedIcon({ name, size = 24 }: { name: "spark" | "close" | "heart" | "check" | "undo"; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "close" ? <path d="m6 6 12 12M18 6 6 18"/> :
      name === "heart" ? <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z"/> :
      name === "check" ? <path d="m5 12 4 4L19 6"/> :
      name === "undo" ? <path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5M4 10l5 5"/> :
      <path d="m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2Z"/>}
  </svg>;
}

export default function EventFeed({ events, categories, cities, onOpen }: Props) {
  const [actions, setActions] = useState<ActionRecord>(readActions);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exit, setExit] = useState<FeedAction | null>(null);
  const [lastAction, setLastAction] = useState<{ id: number; action: FeedAction } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const gesture = useRef<{ id: number; x: number; y: number; dx: number; axis: "x" | "y" | null } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const pageRef = useRef<HTMLElement>(null);
  const effectRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const page = pageRef.current;
    const effect = effectRef.current;
    if (!page || !effect) return;
    const header = document.querySelector(".site-header");
    const footer = page.querySelector(".swipe-help");
    let frame = 0;
    const updateBounds = () => {
      const top = Math.max(0, page.getBoundingClientRect().top, header?.getBoundingClientRect().bottom ?? 0);
      const bottom = Math.min(window.innerHeight, footer?.getBoundingClientRect().top ?? page.getBoundingClientRect().bottom);
      effect.style.top = `${top}px`;
      effect.style.height = `${Math.max(0, bottom - top)}px`;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateBounds);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(page);
    if (header) observer.observe(header);
    if (footer) observer.observe(footer);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    updateBounds();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  const activeEvents = useMemo(() => events.filter(item => item.status === "active" && (categoryId === null || item.categoryId === categoryId)), [events, categoryId]);
  const queue = useMemo(() => activeEvents.filter(item => !actions[item.id]), [actions, activeEvents]);
  const event = queue[0];
  const savedCount = Object.values(actions).filter(item => item === "save").length;
  const progress = activeEvents.length ? (activeEvents.length - queue.length) / activeEvents.length : 0;
  const category = categories.find(item => item.id === event?.categoryId)?.name ?? "Событие";
  const city = cities.find(item => item.id === event?.cityId)?.name;
  const date = event ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(event.startsAt)) : "";
  const strength = Math.min(Math.abs(drag) / 110, 1);
  const red = exit === "skip" ? 1 : drag < 0 ? strength : 0;
  const green = exit === "save" ? 1 : drag > 0 ? strength : 0;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const cancelDrag = () => { gesture.current = null; setDragging(false); setDrag(0); };
  const act = (action: FeedAction) => {
    if (!event || busy.current) return;
    busy.current = true;
    const id = event.id;
    const title = event.title;
    gesture.current = null;
    setDragging(false);
    setExit(action);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(() => {
      setActions(previous => {
        const next = { ...previous, [id]: action };
        saveActions(next);
        return next;
      });
      setLastAction({ id, action });
      setAnnouncement(action === "save" ? `«${title}» сохранено в подборке` : `«${title}» пропущено`);
      setDrag(0);
      setExit(null);
      busy.current = false;
      timer.current = null;
    }, reduced ? 0 : 320);
  };
  const undo = () => {
    if (!lastAction || busy.current) return;
    cancelDrag();
    setActions(previous => {
      const next = { ...previous };
      delete next[lastAction.id];
      saveActions(next);
      return next;
    });
    setLastAction(null);
    setAnnouncement("Последний выбор отменён");
  };
  const reset = () => {
    if (busy.current) return;
    cancelDrag();
    setActions({}); saveActions({}); setLastAction(null);
  };
  const chooseCategory = (id: number | null) => {
    if (busy.current) return;
    cancelDrag(); setCategoryId(id);
  };
  const pointerDown = (pointer: ReactPointerEvent<HTMLElement>) => {
    if ((pointer.target as HTMLElement).closest("button")) return;
    if (busy.current || !pointer.isPrimary || pointer.button !== 0) return;
    gesture.current = { id: pointer.pointerId, x: pointer.clientX, y: pointer.clientY, dx: 0, axis: null };
    pointer.currentTarget.setPointerCapture(pointer.pointerId);
  };
  const pointerMove = (pointer: ReactPointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current || current.id !== pointer.pointerId) return;
    const dx = pointer.clientX - current.x;
    const dy = pointer.clientY - current.y;
    if (!current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (current.axis !== "x") return;
    current.dx = dx;
    setDragging(true);
    setDrag(Math.max(-180, Math.min(180, dx)));
  };
  const pointerUp = (pointer: ReactPointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current || current.id !== pointer.pointerId) return;
    const threshold = Math.min(100, pointer.currentTarget.clientWidth * .24);
    if (current.axis === "x" && Math.abs(current.dx) >= threshold) act(current.dx > 0 ? "save" : "skip");
    else cancelDrag();
  };
  useEffect(() => {
    const handleKey = (keyboard: KeyboardEvent) => {
      const target = keyboard.target as HTMLElement;
      if (keyboard.repeat || keyboard.ctrlKey || keyboard.metaKey || keyboard.altKey || target.closest("input, textarea, select, button, a, [contenteditable], [role=dialog]")) return;
      // The event drawer is rendered outside this component. Do not swipe behind it.
      if (document.querySelector(".fixed.inset-0")) return;
      if (keyboard.key === "ArrowLeft" || keyboard.key === "ArrowRight") {
        keyboard.preventDefault();
        act(keyboard.key === "ArrowLeft" ? "skip" : "save");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [event, exit]);

  return <main ref={pageRef} className="feed-page discovery-feed">
    <div ref={effectRef} className="swipe-viewport" aria-hidden="true">
      <div className="swipe-ambient swipe-ambient--skip" style={{ opacity: red }}/>
      <div className="swipe-ambient swipe-ambient--save" style={{ opacity: green }}/>
    </div>
    <div className="discovery-content">
      <header className="discovery-heading">
        <div><p className="discovery-eyebrow">Планы по настроению</p><h1>А что, если пойти<span>?</span></h1><p className="discovery-intro">Листайте события. Сохраняйте то, что откликается.</p></div>
        <div className="discovery-counter" role="img" aria-label={`Сохранено событий: ${savedCount}`} title={`Сохранено событий: ${savedCount}`}>
          <FavoriteRounded aria-hidden="true"/>
          <b aria-hidden="true">{savedCount > 99 ? "99+" : savedCount}</b>
        </div>
      </header>
      <div className="discovery-categories" aria-label="Категории событий">
        <button disabled={!!exit} aria-pressed={categoryId === null} onClick={() => chooseCategory(null)}>Все события</button>
        {categories.map(item => <button key={item.id} disabled={!!exit} aria-pressed={categoryId === item.id} onClick={() => chooseCategory(item.id)}>{item.name}</button>)}
      </div>
      <div className="discovery-progress"><span>Осталось: {queue.length}</span><div role="progressbar" aria-label="Просмотрено событий" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><i style={{ transform: `scaleX(${progress})` }}/></div></div>
      {event ? <>
        <div className="swipe-deck">
          {queue.length > 1 && <div className="swipe-underlay" aria-hidden="true"/>}
          <div key={event.id} className="swipe-arrival">
            <article className={`swipe-card ${dragging ? "is-dragging" : ""} ${exit ? `is-exiting-${exit}` : ""}`}
              style={!exit ? { transform: `translateX(${drag}px) rotate(${drag / 22}deg)` } : undefined}
              onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
              onPointerCancel={cancelDrag} onLostPointerCapture={() => { if (gesture.current) cancelDrag(); }}>
              <div className="swipe-artwork">
                {event.imageUrl ? <img src={event.imageUrl} alt="" draggable={false}/> : <div className="swipe-placeholder"><FeedIcon name="spark" size={64}/></div>}
                <div className="swipe-artwork-shade"/>
                <span className="swipe-category">{category}</span>
                <span className="swipe-date">{date}</span>
                <div className="swipe-title"><p>{city || "Откройте новое место"}</p><h2><button className="swipe-title-link" disabled={!!exit} onClick={() => onOpen(event)} aria-label={`Открыть событие: ${event.title}`}>{event.title}</button></h2></div>
              </div>
              <div className="swipe-details">
                <p className="swipe-location">{event.locationName}</p>
                <p className="swipe-description">{event.description || "Откройте событие, чтобы узнать подробности и найти компанию."}</p>
                <div className="swipe-social"><span><b>{event.participantsCount}</b> планируют пойти</span><span><b>{event.companiesCount}</b> компаний</span></div>
              </div>
            </article>
          </div>
        </div>
      </> : <section className="discovery-empty"><FeedIcon name="check" size={40}/><h2>{activeEvents.length ? "Все планы просмотрены" : "Пока нет событий"}</h2><p>{activeEvents.length ? "Попробуйте другую категорию или вернитесь к началу подборки." : "Выберите другую категорию — возможно, ваш план уже там."}</p>{activeEvents.length > 0 && <button onClick={reset}>Посмотреть заново</button>}</section>}
      <div className="swipe-actions">
        {event && <>
          <button className="swipe-action swipe-action--skip" disabled={!!exit} onClick={() => act("skip")}><FeedIcon name="close"/><span>Пропустить</span></button>
          <button className="swipe-action swipe-action--save" disabled={!!exit} onClick={() => act("save")}><FeedIcon name="heart"/><span>Сохранить</span></button>
        </>}
        <button className="swipe-action swipe-action--undo" onClick={undo} disabled={!lastAction || !!exit}><FeedIcon name="undo" size={19}/><span>Отменить выбор</span></button>
      </div>
      <footer className="swipe-help"><span>Влево — пропустить · вправо — сохранить</span><small>Сохранение в подборке не записывает вас на мероприятие.</small></footer>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    </div>
  </main>;
}
