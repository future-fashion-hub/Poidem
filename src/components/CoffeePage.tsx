import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LocalCafeOutlined from "@mui/icons-material/LocalCafeOutlined";
import AddRounded from "@mui/icons-material/AddRounded";
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import ChatBubbleOutline from "@mui/icons-material/ChatBubbleOutline";
import CheckRounded from "@mui/icons-material/CheckRounded";
import { api, backendMode } from "../api";
import { ApiError, type DictionaryItem, type User } from "../api/types";
import { collectPages } from "../api/pagination";
import { coffeeAvailable, coffeeCover, coffeeDate, coffeeTopics, filterCoffee } from "../api/coffee";
import type { CoffeeMeeting, CoffeeTopic } from "../api/coffeeTypes";
import SiteSelect from "./SiteSelect";
import CoffeeDialog from "./CoffeeDialog";
import CoffeeCreateModal from "./CoffeeCreateModal";
import "./coffee.css";

type Props = { user: User | null; cities: DictionaryItem[]; onAuth: () => void; onChat: (companyId: number) => void; onPlans: () => void; onChanged: () => void; onModalChange: (open: boolean) => void };
const errorMessage = (error: unknown) => backendMode && error instanceof ApiError && error.status === 404
  ? "Кофе-тайм ещё не подключён к серверу. Для этого раздела нужно подключить API встреч."
  : error instanceof Error ? error.message : "Не удалось загрузить встречи. Попробуйте ещё раз.";
const initials = (name: string) => name.trim().slice(0, 1).toLocaleUpperCase("ru");

export default function CoffeePage({ user, cities, onAuth, onChat, onPlans, onChanged, onModalChange }: Props) {
  const [meetings, setMeetings] = useState<CoffeeMeeting[]>([]);
  const [cityId, setCityId] = useState(0), [topic, setTopic] = useState<CoffeeTopic | "">("");
  const [when, setWhen] = useState("all"), [onlySpots, setOnlySpots] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [creating, setCreating] = useState(false), [selected, setSelected] = useState<CoffeeMeeting | null>(null);
  const [busy, setBusy] = useState(false), [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState(""), [now, setNow] = useState(Date.now);
  const generation = useRef(0), actionBusy = useRef(false), alive = useRef(true);
  const unavailable = backendMode && Boolean(error.includes("ещё не подключён"));
  const visible = useMemo(() => filterCoffee(meetings, when, onlySpots, now), [meetings, when, onlySpots, now]);
  const modalOpen = creating || Boolean(selected);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onModalChange(modalOpen); return () => onModalChange(false); }, [modalOpen, onModalChange]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError("");
    try {
      const result = await collectPages(options => api.listCoffeeMeetings({ cityId: cityId || undefined, topic: topic || undefined }, options), 50, true);
      if (request === generation.current && alive.current) { setMeetings(result.items); setNow(Date.now()); }
    } catch (caught) { if (request === generation.current && alive.current) setError(errorMessage(caught)); }
    finally { if (request === generation.current && alive.current) setLoading(false); }
  }, [cityId, topic, user?.id]);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load]);
  const create = () => { if (!user) { onAuth(); return; } setActionError(""); setCreating(true); };
  const openMeeting = (meeting: CoffeeMeeting) => { setActionError(""); setNotice(""); setSelected(meeting); };
  const apply = (meeting: CoffeeMeeting) => {
    setMeetings(previous => previous.map(item => item.id === meeting.id ? meeting : item));
    setSelected(previous => previous?.id === meeting.id ? meeting : previous);
  };
  const participate = async (meeting: CoffeeMeeting) => {
    if (actionBusy.current) return;
    if (!user) { setSelected(null); onAuth(); return; }
    if (meeting.participation !== "pending" && !coffeeAvailable(meeting)) { setActionError("Эта встреча уже недоступна. Выберите другую."); return; }
    actionBusy.current = true; setBusy(true); setActionError(""); setNotice("");
    try {
      let participation: CoffeeMeeting["participation"] = "none", delta = 0, message = "";
      if (meeting.participation === "pending") {
        await api.cancelMyCompanyApplication(meeting.company.id); message = "Заявка отменена.";
      } else if (meeting.participation === "member") {
        await api.leaveCompany(meeting.company.id); delta = -1; message = "Участие отменено. Если планы изменятся, можно присоединиться снова.";
      } else if (meeting.company.joinType === "request") {
        await api.createCompanyApplication(meeting.company.id, "Хочу присоединиться к вашей встрече на кофе."); participation = "pending"; message = "Заявка отправлена. Организатор рассмотрит её в «Моих планах».";
      } else {
        await api.joinOpenCompany(meeting.company.id); participation = "member"; delta = 1; message = "Место за столиком ваше. Познакомьтесь с компанией в чате.";
      }
      if (!alive.current) return;
      generation.current++; // An earlier list read must not undo a successful write.
      apply({ ...meeting, participation, company: { ...meeting.company, membersCount: meeting.company.membersCount + delta }, event: { ...meeting.event, participantsCount: meeting.event.participantsCount + delta } });
      setNotice(message); onChanged();
    } catch (caught) {
      if (alive.current) {
        setActionError(errorMessage(caught));
        try { const current = await api.getCoffeeMeeting(meeting.id); if (alive.current) apply(current); } catch { /* Keep the actionable original error. */ }
      }
    } finally { actionBusy.current = false; if (alive.current) { setBusy(false); setLoading(false); } }
  };
  const reset = () => { setCityId(0); setTopic(""); setWhen("all"); setOnlySpots(false); };
  const city = (id: number) => cities.find(item => item.id === id)?.name ?? "Город встречи";
  const detailAvailable = selected ? coffeeAvailable(selected, now) : false;
  return <main className="coffee-page mx-auto max-w-[1240px] px-5 pb-20 pt-8 lg:px-8">
    <header className="coffee-hero"><div className="coffee-hero-copy"><p className="coffee-eyebrow">Большие знакомства начинаются с малого</p><h1>Кофе?<br/><span>Уже есть с кем.</span></h1><p>Один столик, пара свободных часов и люди, с которыми ещё не знакомы. Выберите встречу или позовите на свою.</p><button type="button" onClick={create} disabled={unavailable} className="coffee-button coffee-button--primary"><AddRounded aria-hidden="true"/>Позвать на кофе</button><span className="coffee-hero-note">Без билетов и сложных планов. Каждый платит за свой кофе.</span></div><div className="coffee-hero-art" aria-hidden="true"><img src="https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=900&h=1000&fit=crop&auto=format" alt=""/><span className="coffee-art-label"><LocalCafeOutlined/>Можно прийти одному</span><div className="coffee-art-ticket"><span>План на сегодня</span><b>Меньше переписок.<br/>Больше встреч.</b><span className="coffee-art-dots"><i/><i/><i/><i/></span></div></div></header>
    <section className="coffee-catalogue" aria-labelledby="coffee-list-title">
      <div className="coffee-section-heading"><div><p className="coffee-eyebrow">Выбирайте свой столик</p><h2 id="coffee-list-title">С кем выпьем кофе?</h2></div><span className="coffee-icon" aria-hidden="true"><LocalCafeOutlined/></span></div>
      <div className="coffee-filters"><div className="coffee-filter-city"><label htmlFor="coffee-filter-city">Город встречи</label><SiteSelect id="coffee-filter-city" value={cityId} onChange={value => setCityId(Number(value))} options={[{ value: 0, label: "Все города" }, ...cities.map(item => ({ value: item.id, label: item.name }))]}/></div><div className="coffee-filter-topic"><span>Настроение</span><div className="coffee-chips"><button type="button" aria-pressed={!topic} onClick={() => setTopic("")}>Любое</button>{coffeeTopics.map(item => <button type="button" key={item.value} aria-pressed={topic === item.value} onClick={() => setTopic(topic === item.value ? "" : item.value)}>{item.label}</button>)}</div></div></div>
      <div className="coffee-list-toolbar"><div className="coffee-chips coffee-chips--subtle">{[["all", "Все встречи"], ["today", "Сегодня"], ["week", "На неделе"], ["mine", "Я участвую"]].map(([value, label]) => <button type="button" key={value} aria-pressed={when === value} onClick={() => { setWhen(value); if (value === "mine" && !user) onAuth(); }}>{label}</button>)}</div><label className="coffee-only-spots"><input type="checkbox" checked={onlySpots} onChange={event => setOnlySpots(event.target.checked)}/>Есть свободные места</label></div>
      {!modalOpen && notice && <p className="coffee-feedback" role="status">{notice}</p>}
      {error ? <div className="coffee-empty" role="alert"><LocalCafeOutlined aria-hidden="true"/><h3>Пока не удалось загрузить встречи</h3><p>{error}</p><button type="button" className="coffee-button coffee-button--secondary" onClick={() => { void load(); }}>Попробовать ещё раз</button></div>
        : loading ? <div className="coffee-grid" role="status" aria-label="Загружаем встречи">{[1, 2, 3].map(id => <div className="coffee-skeleton" key={id}/>)}</div>
          : visible.length ? <><p className="coffee-results-count" role="status">Встреч: {visible.length}</p><div className="coffee-grid">{visible.map(meeting => {
            const full = meeting.company.membersCount >= meeting.company.maxMembers, joined = meeting.participation === "member" || meeting.participation === "owner";
            return <article key={meeting.id} className="coffee-card"><button type="button" className="coffee-card-cover" onClick={() => openMeeting(meeting)} aria-label={`Открыть встречу «${meeting.event.title}»`}><img src={meeting.event.imageUrl ?? coffeeCover} alt="" loading="lazy"/><span>{coffeeTopics.find(item => item.value === meeting.topic)?.label}</span>{joined && <b><CheckRounded aria-hidden="true"/>Вы идёте</b>}</button><div className="coffee-card-body"><time dateTime={meeting.event.startsAt}><ScheduleOutlined aria-hidden="true"/>{coffeeDate(meeting.event.startsAt)}</time><h3><button type="button" onClick={() => openMeeting(meeting)}>{meeting.event.title}</button></h3><p className="coffee-card-description">{meeting.event.description}</p><p className="coffee-card-place"><PlaceOutlined aria-hidden="true"/><span>{city(meeting.event.cityId)} · {meeting.event.locationName}</span></p><div className="coffee-card-host"><span className="coffee-avatar">{meeting.company.owner.avatarUrl ? <img src={meeting.company.owner.avatarUrl} alt=""/> : initials(meeting.company.owner.firstName)}</span><div><small>Зовёт на кофе</small><b>{meeting.company.owner.firstName}</b></div><span className="coffee-seat-count"><GroupsOutlined aria-hidden="true"/>{meeting.company.membersCount}/{meeting.company.maxMembers}</span></div><footer><span>{meeting.event.status === "pending" ? "На проверке" : meeting.participation === "pending" ? "Заявка отправлена" : full ? "Все места заняты" : meeting.company.status === "closed" ? "Набор закрыт" : meeting.company.joinType === "request" ? "По заявке" : "Свободное вступление"}</span><button type="button" className="coffee-card-open" onClick={() => openMeeting(meeting)} aria-label={`Подробнее о встрече «${meeting.event.title}»`}><ArrowOutwardRounded aria-hidden="true"/></button></footer></div></article>;
          })}</div></> : <div className="coffee-empty"><LocalCafeOutlined aria-hidden="true"/><h3>{when === "mine" ? "Ваш столик ещё впереди" : "Здесь пока свободный столик"}</h3><p>{when === "mine" ? "Присоединитесь к встрече или позовите свою компанию на кофе." : "Для этих фильтров встреч пока нет. Можно выбрать другой город или создать первую."}</p><div><button type="button" className="coffee-button coffee-button--secondary" onClick={reset}>Сбросить фильтры</button><button type="button" className="coffee-button coffee-button--primary" onClick={create}>Позвать на кофе</button></div></div>}
    </section>
    <aside className="coffee-how"><h2>Знакомиться проще,<br/>чем кажется.</h2><ol><li><b>01</b><span>Выберите столик<small>По городу, времени и настроению.</small></span></li><li><b>02</b><span>Скажите «я с вами»<small>Присоединитесь или отправьте заявку.</small></span></li><li><b>03</b><span>Встретьтесь вживую<small>Детали можно обсудить в чате компании.</small></span></li></ol></aside>
    {creating && user && <CoffeeCreateModal cities={cities} cityId={cityId || user.city?.id || 0} onClose={() => setCreating(false)} onCreated={meeting => { generation.current++; setLoading(false); setCreating(false); setMeetings(previous => [meeting, ...previous.filter(item => item.id !== meeting.id)]); setCityId(0); setTopic(""); setWhen("mine"); setOnlySpots(false); setNotice(meeting.event.status === "pending" ? "Встреча создана и ожидает проверки. Найти её можно в «Моих планах»." : "Встреча создана! Компания и чат уже ждут в «Моих планах»."); onChanged(); }}/>}
    {selected && <CoffeeDialog title={selected.event.title} busy={busy} onClose={() => setSelected(null)}>{() => <div className="coffee-detail"><img className="coffee-detail-image" src={selected.event.imageUrl ?? coffeeCover} alt=""/><div className="coffee-detail-facts"><p><ScheduleOutlined aria-hidden="true"/><span>{coffeeDate(selected.event.startsAt)}<small>До {new Date(selected.event.endsAt ?? selected.event.startsAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</small></span></p><p><PlaceOutlined aria-hidden="true"/><span>{city(selected.event.cityId)} · {selected.event.locationName}<small>{selected.event.address || "Точную точку встречи обсудим в чате."}</small></span></p><p><GroupsOutlined aria-hidden="true"/><span>{selected.company.membersCount} из {selected.company.maxMembers} за столиком<small>Зовёт {selected.company.owner.firstName}</small></span></p></div><p className="coffee-detail-description">{selected.event.description}</p><p className="coffee-form-note">{selected.company.rules || "Напитки каждый оплачивает самостоятельно. Если планы поменялись, предупредите компанию."}</p>
      {notice && <p className="coffee-feedback" role="status">{notice}</p>}{actionError && <p className="coffee-feedback coffee-feedback--error" role="alert">{actionError}</p>}
      {!detailAvailable && <p className="coffee-feedback" role="status">{selected.event.status === "pending" ? "Встреча ожидает проверки." : "Эта встреча уже завершилась или недоступна."}</p>}
      <div className="coffee-detail-actions">{selected.participation === "owner" || selected.participation === "member" ? <><button type="button" className="coffee-button coffee-button--primary" disabled={busy || !detailAvailable} onClick={() => onChat(selected.company.id)}><ChatBubbleOutline aria-hidden="true"/>Открыть чат</button>{selected.participation === "owner" ? <button type="button" className="coffee-button coffee-button--secondary" onClick={onPlans}>Управлять компанией</button> : <button type="button" className="coffee-button coffee-button--secondary" disabled={busy || !detailAvailable} onClick={() => { void participate(selected); }}>{busy ? "Сохраняем…" : "Не смогу прийти"}</button>}</>
        : selected.participation === "pending" ? <><p className="coffee-pending"><CheckRounded aria-hidden="true"/>Заявка отправлена</p><button type="button" className="coffee-button coffee-button--secondary" disabled={busy} onClick={() => { void participate(selected); }}>{busy ? "Отменяем…" : "Отменить заявку"}</button></>
          : <button type="button" className="coffee-button coffee-button--primary" disabled={busy || !detailAvailable || selected.company.status !== "active" || selected.company.membersCount >= selected.company.maxMembers} aria-busy={busy} onClick={() => { void participate(selected); }}><LocalCafeOutlined aria-hidden="true"/>{busy ? "Сохраняем…" : !detailAvailable ? "Встреча недоступна" : selected.company.membersCount >= selected.company.maxMembers ? "Все места заняты" : selected.company.status !== "active" ? "Набор закрыт" : !user ? "Войти и присоединиться" : selected.company.joinType === "request" ? "Отправить заявку" : "Пойду на кофе"}</button>}</div>
    </div>}</CoffeeDialog>}
  </main>;
}
