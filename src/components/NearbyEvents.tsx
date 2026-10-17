import { usePopupDismiss } from "./usePopupDismiss";
import { useModalDialog } from "./useModalDialog";
import { countLabel } from "../api/russianCount";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import TravelExploreOutlined from "@mui/icons-material/TravelExploreOutlined";
import NearMeOutlined from "@mui/icons-material/NearMeOutlined";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import { api } from "../api";
import { collectPages } from "../api/pagination";
import { getNearbyLocation } from "../api/nearbyPermissions";
import { createShakeDetector, distanceLabel, nearbyBounds, nearbyEvents, type Coordinates, type NearbyEvent } from "../api/nearby";
import type { DictionaryItem, Event } from "../api/types";
import "./nearby.css";

type MotionConstructor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> };
type MotionState = "available" | "permission" | "enabled" | "denied" | "unsupported";
type SearchState = "idle" | "locating" | "loading" | "ready" | "error";
type Props = { open: boolean; onOpenChange: (open: boolean) => void; suspended: boolean; categories: DictionaryItem[]; onOpenEvent: (event: Event) => void; onBrowseMap: () => void; isPublicEvent?: (event: Event) => boolean };
const radii = [5, 10, 25, 50];
const motionAPI = () => typeof DeviceMotionEvent === "undefined" ? null : DeviceMotionEvent as MotionConstructor;
const initialMotionState = (): MotionState => !window.isSecureContext || !motionAPI() ? "unsupported" : motionAPI()?.requestPermission ? "permission" : "available";
const dateLabel = (value: string) => new Date(value).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default function NearbyEvents({ open, onOpenChange, suspended, categories, onOpenEvent, onBrowseMap, isPublicEvent }: Props) {
  const [motionState, setMotionState] = useState<MotionState>(initialMotionState);
  const [radius, setRadius] = useState(10);
  const [state, setState] = useState<SearchState>("idle");
  const [results, setResults] = useState<NearbyEvent[]>([]);
  const [error, setError] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [shakeVersion, setShakeVersion] = useState(0);
  const animatedShake = useRef(0);
  const position = useRef<Coordinates | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const runRef = useRef<() => void>(() => undefined);
  const keyboardOpened = useRef(false);
  const loading = state === "locating" || state === "loading";

  const search = useCallback(async (nextRadius: number, fromTap = false, reusePosition = false, refreshPosition = false) => {
    if (busy.current || suspended || document.visibilityState === "hidden") return;
    busy.current = true;
    const current = ++generation.current;
    setState("locating"); setError(""); onOpenChange(true);
    try {
      // iOS must receive this call synchronously within the original tap.
      if (fromTap && motionState === "permission") {
        try { setMotionState(await motionAPI()!.requestPermission!() === "granted" ? "enabled" : "denied"); }
        catch { setMotionState("denied"); }
      }
      if (current !== generation.current) return;
      let point = reusePosition ? position.current : null;
      if (!point) {
        const located = await getNearbyLocation(refreshPosition);
        if (current !== generation.current) return;
        point = { latitude: located.coords.latitude, longitude: located.coords.longitude };
        position.current = point; setAccuracy(located.coords.accuracy);
      }
      setState("loading");
      const list = await collectPages(options => api.listEvents({ ...nearbyBounds(point!, nextRadius), sort: "date" }, options));
      if (current !== generation.current) return;
      setResults(nearbyEvents(isPublicEvent ? list.items.filter(isPublicEvent) : list.items, point, nextRadius));
      setState("ready");
    } catch (caught) {
      if (current !== generation.current) return;
      setError(caught instanceof Error ? caught.message : "Поиск не удался. Проверьте интернет и попробуйте ещё раз.");
      setState("error");
    } finally { if (current === generation.current) busy.current = false; }
  }, [motionState, onOpenChange, suspended, isPublicEvent]);

  useEffect(() => {
    runRef.current = () => {
      if (busy.current || suspended || document.visibilityState !== "visible") return;
      keyboardOpened.current = false;
      setShakeVersion(version => version + 1);
      // Unsupported or blocked haptics must never interrupt the search.
      try { navigator.vibrate?.([70, 60, 70]); } catch { /* Best-effort feedback. */ }
      void search(radius);
    };
  }, [search, radius, suspended]);
  useEffect(() => {
    if (!open || !panel.current || !shakeVersion || animatedShake.current === shakeVersion) return;
    animatedShake.current = shakeVersion;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Animate a separate layer so Safari does not combine shaking with the slide transform.
    const animation = panel.current.parentElement?.animate?.([
      { transform: "translate3d(0,0,0)" }, { transform: "translate3d(-9px,0,0)" }, { transform: "translate3d(9px,0,0)" },
      { transform: "translate3d(-7px,0,0)" }, { transform: "translate3d(6px,0,0)" }, { transform: "translate3d(-4px,0,0)" },
      { transform: "translate3d(3px,0,0)" }, { transform: "translate3d(-1px,0,0)" }, { transform: "translate3d(0,0,0)" },
    ], { duration: 680, easing: "ease-in-out" });
    return () => animation?.cancel();
  }, [shakeVersion, open]);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    if (suspended) {
      generation.current++; busy.current = false; setState("idle");
      if (open) onOpenChange(false);
    }
  }, [suspended, open, onOpenChange]);
  useEffect(() => {
    if (suspended || (motionState !== "available" && motionState !== "enabled")) return;
    let detect = createShakeDetector();
    const reset = () => { detect = createShakeDetector(); };
    const onMotion = (event: DeviceMotionEvent) => {
      if (document.visibilityState !== "visible" || busy.current) return;
      const acceleration = event.acceleration?.x != null ? event.acceleration : event.accelerationIncludingGravity;
      if (!acceleration) return;
      if (detect(acceleration, event.timeStamp)) runRef.current();
    };
    window.addEventListener("devicemotion", onMotion, { passive: true });
    document.addEventListener("visibilitychange", reset);
    return () => { window.removeEventListener("devicemotion", onMotion); document.removeEventListener("visibilitychange", reset); };
  }, [motionState, suspended]);
  useEffect(() => { if (open) closeButton.current?.focus(); }, [open]);

  const finishClose = () => {
    generation.current++; busy.current = false;
    if (loading) setState("idle");
    onOpenChange(false);
    requestAnimationFrame(() => { if (keyboardOpened.current) trigger.current?.focus(); else trigger.current?.blur(); });
  };
  const { closing, dismiss: close } = usePopupDismiss(finishClose, open);
  useModalDialog(panel, close, open);
  const changeRadius = (next: number) => { setRadius(next); void search(next, false, true); };
  const trapFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key !== "Tab") return;
    const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]') ?? []);
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
  };

  return <>
    <button ref={trigger} type="button" className="nearby-trigger" hidden={suspended || open} aria-haspopup="dialog" aria-expanded={open} aria-controls="nearby-dialog" onClick={event => { keyboardOpened.current = event.detail === 0; void search(radius, true); }}>
      <span className="nearby-trigger-icon"><TravelExploreOutlined aria-hidden="true"/></span>
      <span className="nearby-label-touch"><strong>Встряхни, чтобы найти<br/>события рядом</strong><small>Геопозиция нужна только для поиска рядом</small></span>
      <span className="nearby-label-desktop"><strong>Найти события рядом</strong><small>Используем геопозицию только для поиска рядом</small></span>
    </button>
    {open && createPortal(<div data-closing={closing || undefined} className="nearby-overlay" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="nearby-shake-layer"><section id="nearby-dialog" ref={panel} className="nearby-panel" role="dialog" aria-modal="true" aria-labelledby="nearby-title" onKeyDown={trapFocus}>
        <header className="nearby-heading"><span className="nearby-heading-icon"><TravelExploreOutlined aria-hidden="true"/></span><div><p>Ближе, чем кажется</p><h2 id="nearby-title">События рядом<span>.</span></h2></div><button ref={closeButton} type="button" className="nearby-close" aria-label="Закрыть события рядом" onClick={close}><CloseRounded/></button></header>
        <div className="nearby-controls"><div><span><NearMeOutlined aria-hidden="true"/>От вашей геопозиции</span><button type="button" disabled={loading} className="nearby-refresh" onClick={() => { void search(radius, true, false, true); }} aria-label="Обновить геопозицию и события"><RefreshRounded/></button></div><div className="nearby-radius" aria-label="Радиус поиска">{radii.map(value => <button key={value} type="button" aria-pressed={radius === value} disabled={loading} onClick={() => changeRadius(value)}>{value} км</button>)}</div></div>
        <div className="nearby-content" aria-busy={loading}>
          {loading ? <div className="nearby-state" role="status"><span className="nearby-searching"><TravelExploreOutlined aria-hidden="true"/></span><h3>{state === "locating" ? "Ищем вашу точку на карте" : "Собираем планы поблизости"}</h3><p>{state === "locating" ? "Разрешите доступ к геопозиции, если браузер попросит." : `Смотрим события в радиусе ${radius} км.`}</p></div>
            : state === "error" ? <div className="nearby-state"><NearMeOutlined aria-hidden="true"/><h3>Пока не удалось найти вас</h3><p role="alert">{error}</p><button type="button" className="nearby-primary" onClick={() => { void search(radius, true); }}>Попробовать ещё раз</button><button type="button" className="nearby-primary" onClick={onBrowseMap}>Выбрать город на карте</button></div>
            : state === "ready" ? <>
              <div className="nearby-summary" role="status">Найдено: {countLabel(results.length, "events")}{accuracy !== null && accuracy > 1000 && <span>Геопозиция приблизительная: ±{distanceLabel(accuracy / 1000)}</span>}</div>
              {results.length ? <div className="nearby-list">{results.map(({ event, distance }) => <button type="button" key={event.id} className="nearby-card" onClick={() => { onOpenChange(false); onOpenEvent(event); }} aria-label={`Открыть ${event.title}, ${distanceLabel(distance)} от вас`}>
                <span className="nearby-card-image">{event.imageUrl ? <img src={event.imageUrl} alt="" loading="lazy"/> : <TravelExploreOutlined aria-hidden="true"/>}</span><span className="nearby-card-copy"><span className="nearby-card-meta"><span>{categories.find(item => item.id === event.categoryId)?.name ?? "Событие"}</span><b>{distanceLabel(distance)}</b></span><strong>{event.title}</strong><time dateTime={event.startsAt}>{dateLabel(event.startsAt)}</time><span className="nearby-card-place">{event.locationName}</span></span><ArrowOutwardRounded className="nearby-card-arrow" aria-hidden="true"/>
              </button>)}</div> : <div className="nearby-state"><TravelExploreOutlined aria-hidden="true"/><h3>Пока нет планов так близко</h3><p>В радиусе {radius} км нет ближайших событий с точкой на карте.{radius < 50 ? " Давайте посмотрим чуть дальше?" : " Загляните позже — афиша пополняется."}</p>{radius < 50 && <button type="button" className="nearby-primary" onClick={() => changeRadius(radii[radii.indexOf(radius) + 1])}>Посмотреть в радиусе {radii[radii.indexOf(radius) + 1]} км</button>}</div>}
            </> : null}
        </div>
        <footer className="nearby-footnote"><span>{motionState === "enabled" || motionState === "available" ? "Встряхните телефон ещё раз, чтобы обновить подборку." : motionState === "denied" ? "Доступ к движению закрыт. Поиск по нажатию работает." : motionState === "permission" ? "Нажмите обновление, чтобы включить поиск встряхиванием." : "На этом устройстве используйте поиск по нажатию."}</span><small>Местоположение используется только для поиска рядом.</small></footer>
      </section></div>
    </div>, document.body)}
  </>;
}
