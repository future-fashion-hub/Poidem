import { useEffect, useMemo, useRef, useState } from "react";
import type { DictionaryItem, Event } from "../api/types";

type FeedAction = "skip" | "save";
type Props = { events: Event[]; categories: DictionaryItem[]; cities: DictionaryItem[]; onOpen: (event: Event) => void };
type ActionRecord = Record<number, FeedAction>;
const storageKey = "poidem-event-feed-actions";

function readActions(): ActionRecord {
  try { return JSON.parse(localStorage.getItem(storageKey) ?? "{}"); } catch { return {}; }
}

function saveActions(next: ActionRecord) { localStorage.setItem(storageKey, JSON.stringify(next)); }

export default function EventFeed({ events, categories, cities, onOpen }: Props) {
  const [actions, setActions] = useState<ActionRecord>(readActions);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [drag, setDrag] = useState(0);
  const [lastAction, setLastAction] = useState<{ id: number; action: FeedAction } | null>(null);
  const startX = useRef<number | null>(null);
  const activeEvents = useMemo(() => events.filter((event) => event.status === "active" && (categoryId === null || event.categoryId === categoryId)), [categoryId, events]);
  const queue = useMemo(() => activeEvents.filter((event) => !actions[event.id]), [actions, activeEvents]);
  const event = queue[0];
  const savedCount = Object.values(actions).filter((item) => item === "save").length;
  const progress = activeEvents.length ? Math.round(((activeEvents.length - queue.length) / activeEvents.length) * 100) : 0;
  const category = event && categories.find((item) => item.id === event.categoryId)?.name;
  const city = event && cities.find((item) => item.id === event.cityId)?.name;
  const date = event && new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(event.startsAt));

  const act = (action: FeedAction) => {
    if (!event) return;
    const next = { ...actions, [event.id]: action };
    setActions(next); saveActions(next); setLastAction({ id: event.id, action }); setDrag(0);
  };
  const undo = () => {
    if (!lastAction) return;
    const next = { ...actions }; delete next[lastAction.id]; setActions(next); saveActions(next); setLastAction(null);
  };
  const reset = () => { localStorage.removeItem(storageKey); setActions({}); setLastAction(null); };
  const endDrag = () => { if (Math.abs(drag) > 82) act(drag > 0 ? "save" : "skip"); else setDrag(0); startX.current = null; };
  useEffect(() => {
    const handleKey = (keyboard: KeyboardEvent) => {
      if ((keyboard.target as HTMLElement)?.tagName === "INPUT") return;
      if (keyboard.key === "ArrowLeft") act("skip");
      if (keyboard.key === "ArrowRight") act("save");
      if (keyboard.key === "z" && (keyboard.metaKey || keyboard.ctrlKey)) undo();
    };
    window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey);
  }, [event, actions, lastAction]);

  return <main className="feed-page mx-auto max-w-[1240px] px-5 py-10 lg:px-8"><div className="mx-auto max-w-[620px]"><header className="mb-6 rounded-[30px] border border-[#d9e7d4] bg-white/80 p-5 text-center shadow-[0_14px_45px_rgba(35,65,42,.06)] backdrop-blur sm:p-6"><div className="flex items-center justify-between gap-4"><div className="text-left"><p className="text-xs font-black uppercase tracking-[.18em] text-[#638568]">Быстрый выбор</p><h1 className="mt-1 text-3xl font-black tracking-[-.055em] sm:text-4xl">Лента событий</h1></div><div className="rounded-2xl bg-[#eff9db] px-3 py-2 text-right"><b className="block text-lg leading-none text-[#244d2f]">{savedCount}</b><span className="text-[10px] font-bold uppercase tracking-wide text-[#64806a]">сохранено</span></div></div><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#e6eee4]"><div className="h-full rounded-full bg-[#a8db37] transition-all duration-300" style={{ width: `${progress}%` }}/></div><p className="mt-2 text-left text-xs font-medium text-[#718075]">{queue.length ? `Осталось ${queue.length} ${queue.length === 1 ? "событие" : "событий"}` : "В этой подборке всё просмотрено"}</p></header><div className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"><button onClick={() => setCategoryId(null)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${categoryId === null ? "bg-[#102318] text-[#dff8a1] shadow-sm" : "border border-[#d7e3d4] bg-white text-[#59705d] hover:border-[#9eb99e]"}`}>Все</button>{categories.map((item) => <button key={item.id} onClick={() => setCategoryId(item.id)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${categoryId === item.id ? "bg-[#102318] text-[#dff8a1] shadow-sm" : "border border-[#d7e3d4] bg-white text-[#59705d] hover:border-[#9eb99e]"}`}>{item.name}</button>)}</div>{event ? <><div className="relative select-none" onPointerDown={(item) => { startX.current = item.clientX; item.currentTarget.setPointerCapture(item.pointerId); }} onPointerMove={(item) => { if (startX.current !== null) setDrag(Math.max(-145, Math.min(145, item.clientX - startX.current))); }} onPointerUp={endDrag} onPointerCancel={endDrag}><div className="pointer-events-none absolute left-5 top-5 z-10 rounded-xl border-2 border-[#b44d43] bg-white/90 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[#a9433a] shadow-sm" style={{ opacity: Math.max(0, -drag / 72) }}>Не моё</div><div className="pointer-events-none absolute right-5 top-5 z-10 rounded-xl border-2 border-[#598b2e] bg-white/90 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[#4f7d2a] shadow-sm" style={{ opacity: Math.max(0, drag / 72) }}>Сохранить</div><article className="overflow-hidden rounded-[34px] border border-[#d7e4d4] bg-white shadow-[0_24px_70px_rgba(35,65,42,.16)] transition-transform duration-200" style={{ transform: `translateX(${drag}px) rotate(${drag / 19}deg)` }}><div className="relative h-[320px] bg-[#e7f0e3] sm:h-[350px]">{event.imageUrl ? <img src={event.imageUrl} alt="" draggable={false} className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_30%_20%,#dff8a1,transparent_35%),linear-gradient(135deg,#345d3c,#102318)] text-6xl text-[#dff8a1]">✦</div>}<div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#102318]/75 to-transparent"/><span className="absolute bottom-4 left-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-black text-[#27452e] shadow-sm">{category ?? "Событие"}</span></div><div className="p-6"><p className="text-xs font-bold uppercase tracking-[.1em] text-[#6d8870]">{date} · {city}</p><h2 className="mt-2 text-2xl font-black tracking-[-.045em]">{event.title}</h2><p className="mt-3 min-h-[48px] text-sm leading-6 text-[#627466]">{event.description || event.locationName}</p><div className="mt-5 flex items-center justify-between border-t border-[#edf1ea] pt-4 text-xs font-bold text-[#647668]"><span>{event.participantsCount} уже планируют</span><span>{event.companiesCount} компаний</span></div></div></article></div><div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><button onClick={() => act("skip")} className="justify-self-end grid h-14 w-14 place-items-center rounded-2xl border border-[#edc2bc] bg-white text-2xl font-bold text-[#a9433a] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" aria-label="Пропустить событие">×</button><button onClick={() => onOpen(event)} className="rounded-xl bg-[#102318] px-5 py-3 text-sm font-extrabold text-[#dff8a1] shadow-sm transition hover:bg-[#1c3c27]">Подробнее</button><button onClick={() => act("save")} className="grid h-14 w-14 place-items-center rounded-2xl bg-[#bdf238] text-xl font-black text-[#102318] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" aria-label="Сохранить событие">♥</button></div><div className="mt-4 flex items-center justify-center gap-2"><span className="text-xs text-[#829084]">← пропустить · сохранить →</span>{lastAction ? <button onClick={undo} className="rounded-lg px-2 py-1 text-xs font-bold text-[#476d4d] underline decoration-[#a8db37] underline-offset-4">Отменить</button> : null}</div></> : <section className="rounded-[34px] border border-dashed border-[#b9cfb8] bg-white px-7 py-20 text-center shadow-sm"><div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#e8f3db] text-3xl">✓</div><h2 className="mt-5 text-2xl font-black">Лента просмотрена</h2><p className="mt-3 text-sm leading-6 text-[#718075]">Вы отметили все события этой подборки. Можно сменить категорию или начать заново.</p><button onClick={reset} className="mt-6 rounded-xl bg-[#102318] px-5 py-3 text-sm font-extrabold text-[#dff8a1] transition hover:bg-[#1c3c27]">Показать снова</button></section>}</div></main>;
}
