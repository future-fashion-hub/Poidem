import { useEffect, useMemo, useState } from "react";
import ForumOutlined from "@mui/icons-material/ForumOutlined";
import { api } from "../api";
import type { Application, Company, DictionaryItem, Event, User } from "../api/types";

type Tab = "profile" | "events" | "companies" | "applications" | "settings";

type Props = {
  user: User;
  cities: DictionaryItem[];
  categories: DictionaryItem[];
  onUpdate: (user: User) => void;
  onOpenEvent: (event: Event) => void;
  onFindEvents: () => void;
  onOpenChats: () => void;
};

const tabLabels: Array<[Tab, string, string]> = [
  ["profile", "◉", "Мой профиль"], ["events", "◷", "Мои события"], ["companies", "◌", "Мои компании"], ["applications", "♧", "Заявки"], ["settings", "⚙", "Настройки"],
];
const formatDate = (value: string) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export default function UserDashboard({ user, cities, categories, onUpdate, onOpenEvent, onFindEvents, onOpenChats }: Props) {
  const [tab, setTab] = useState<Tab>("profile");
  const [events, setEvents] = useState<Event[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [editing, setEditing] = useState(false);
  const [about, setAbout] = useState(user.about ?? "");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.all([api.listMyEvents(), api.listMyCompanies(), api.listMyApplications()])
      .then(([eventList, companyList, applicationList]) => { setEvents(eventList.items); setCompanies(companyList.items); setApplications(applicationList.items); })
      .catch(() => { setEvents([]); setCompanies([]); setApplications([]); });
  }, []);

  const cityName = user.city?.name ?? "Город не указан";
  const initials = `${user.firstName[0] ?? "П"}${user.lastName?.[0] ?? ""}`;
  const activeCompanies = useMemo(() => companies.filter((company) => company.status === "active"), [companies]);

  const saveProfile = async () => {
    try {
      const next = await api.updateMyProfile({ about });
      onUpdate(next); setEditing(false); setNotice("Профиль сохранён");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось сохранить профиль"); }
  };

  return <main className="mx-auto max-w-[1240px] px-5 py-10 lg:px-8">
    <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
      <aside className="h-fit rounded-3xl border border-[#dce5da] bg-white p-3 lg:sticky lg:top-24">
        {tabLabels.map(([value, icon, label]) => <button key={value} onClick={() => setTab(value)} className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${tab === value ? "bg-[#e7f8c9] text-[#21462e]" : "text-[#526258] hover:bg-[#f2f6ef]"}`}><span className="w-5 text-center text-base">{icon}</span>{label}</button>)}
      </aside>
      <section>
        <div className="rounded-[30px] border border-[#dce5da] bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[24px] bg-[#bdf238] text-2xl font-black text-[#102318]">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover"/> : initials}</div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black tracking-[-.04em] sm:text-3xl">{user.firstName} {user.lastName}</h1>{user.role === "admin" ? <span className="rounded-full bg-[#e7f8c9] px-2 py-1 text-[10px] font-extrabold text-[#416949]">Участник</span> : null}</div><p className="mt-1 text-sm text-[#718075]">{cityName}</p><p className="mt-3 text-sm leading-6 text-[#607267]">{user.about || "Расскажите немного о себе, чтобы другим было легче познакомиться."}</p></div>{tab === "profile" ? <button onClick={() => setEditing(!editing)} className="rounded-xl border border-[#cfdacd] px-4 py-2.5 text-sm font-bold hover:bg-[#f2f6ef]">{editing ? "Закрыть" : "Редактировать"}</button> : null}</div>
          {editing ? <div className="mt-6 border-t border-[#edf1ea] pt-6"><label className="block text-sm font-bold">О себе<textarea value={about} onChange={(event) => setAbout(event.target.value)} maxLength={2000} rows={4} className="mt-2 w-full rounded-2xl border border-[#dce5da] bg-[#fbfcfa] px-4 py-3 text-sm font-normal outline-none focus:border-[#86b92e]"/></label><div className="mt-4 flex gap-3"><button onClick={saveProfile} className="rounded-xl bg-[#102318] px-5 py-3 text-sm font-extrabold text-[#bdf238]">Сохранить изменения</button><button onClick={() => { setAbout(user.about ?? ""); setEditing(false); }} className="rounded-xl border border-[#cfdacd] px-4 py-3 text-sm font-bold">Отмена</button></div></div> : null}
        </div>
        <div className="mt-6 flex flex-wrap gap-3"><button onClick={onFindEvents} className="rounded-xl bg-[#102318] px-5 py-3 text-sm font-extrabold text-[#bdf238]">Найти новое событие</button><button onClick={() => setTab("companies")} className="rounded-xl border border-[#cfdacd] bg-white px-5 py-3 text-sm font-extrabold">Мои компании</button></div>
        {notice ? <p className="mt-4 rounded-xl bg-[#eff7e8] px-4 py-3 text-sm font-semibold text-[#416949]">{notice}</p> : null}
        {tab === "profile" ? <div className="mt-9"><h2 className="text-2xl font-black">Ваши интересы</h2><div className="mt-4 flex flex-wrap gap-2">{user.interests.length ? user.interests.map((interest) => <span key={interest.id} className="rounded-full border border-[#91ad7e] bg-[#eff9db] px-3 py-1.5 text-xs font-bold text-[#31513a]">{interest.name}</span>) : <span className="text-sm text-[#718075]">Интересы пока не выбраны.</span>}</div></div> : null}
        {tab === "events" ? <DashboardEvents events={events} categories={categories} onOpen={onOpenEvent}/> : null}
        {tab === "companies" ? <DashboardCompanies user={user} companies={activeCompanies} events={events} onOpenChats={onOpenChats}/> : null}
        {tab === "applications" ? <DashboardApplications applications={applications}/> : null}
        {tab === "settings" ? <div className="mt-9 rounded-3xl border border-[#dce5da] bg-white p-6"><h2 className="text-2xl font-black">Настройки</h2><label className="mt-5 flex items-center justify-between gap-5 text-sm font-semibold"><span>Напоминать о событиях и заявках</span><input type="checkbox" defaultChecked className="h-5 w-5 accent-[#557d26]"/></label><p className="mt-3 text-sm leading-6 text-[#718075]">Настройки уведомлений будут сохранены в профиле после подключения соответствующего метода API.</p></div> : null}
      </section>
    </div>
  </main>;
}

function DashboardEvents({ events, categories, onOpen }: { events: Event[]; categories: DictionaryItem[]; onOpen: (event: Event) => void }) {
  return <div className="mt-9"><h2 className="text-2xl font-black">Мои события</h2>{events.length ? <div className="mt-5 grid gap-5 sm:grid-cols-2">{events.map((event) => <button key={event.id} onClick={() => onOpen(event)} className="overflow-hidden rounded-3xl border border-[#dce5da] bg-white text-left transition hover:-translate-y-0.5 hover:shadow-lg"><img src={event.imageUrl ?? ""} alt="" className="h-36 w-full object-cover"/><div className="p-4"><span className="text-xs font-bold text-[#69826e]">{categories.find((item) => item.id === event.categoryId)?.name}</span><h3 className="mt-2 font-extrabold">{event.title}</h3><p className="mt-2 text-xs text-[#718075]">{formatDate(event.startsAt)}</p></div></button>)}</div> : <p className="mt-4 rounded-2xl border border-dashed border-[#cfdacd] bg-white p-7 text-sm text-[#718075]">Пока нет событий. Найдите подходящее на карте.</p>}</div>;
}

function DashboardCompanies({ user, companies, events, onOpenChats }: { user: User; companies: Company[]; events: Event[]; onOpenChats: () => void }) {
  return <div className="mt-9"><h2 className="text-2xl font-black">Мои компании и группы</h2><div className="mt-5 space-y-3">{companies.length ? companies.map((company) => <div key={company.id} className="rounded-2xl border border-[#dce5da] bg-white p-5"><div className="flex items-center justify-between gap-4"><div><h3 className="font-extrabold">{company.name}</h3><p className="mt-1 text-sm text-[#718075]">Событие: {events.find((event) => event.id === company.eventId)?.title ?? `#${company.eventId}`}</p></div><div className="flex shrink-0 items-center gap-2"><span className="hidden rounded-full bg-[#e7f8c9] px-3 py-1 text-xs font-bold text-[#416949] sm:block">активна</span><button onClick={onOpenChats} aria-label={`Открыть чат компании ${company.name}`} className="grid h-10 w-10 place-items-center rounded-xl bg-[#102318] text-[#bdf238]"><ForumOutlined fontSize="small" /></button></div></div>{company.owner.id === user.id ? <CompanyApplications company={company} /> : null}</div>) : <p className="rounded-2xl border border-dashed border-[#cfdacd] bg-white p-7 text-sm text-[#718075]">Активных компаний пока нет.</p>}</div></div>;
}

function CompanyApplications({ company }: { company: Company }) {
  const [open, setOpen] = useState(false); const [items, setItems] = useState<Application[]>([]); const [profile, setProfile] = useState<User | null>(null); const [error, setError] = useState("");
  const load = async () => { try { setItems((await api.listCompanyApplications(company.id)).items); } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось загрузить заявки"); } };
  const resolve = async (id: number, action: "approve" | "reject") => { try { await api.resolveCompanyApplication(company.id, id, action); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось обработать заявку"); } };
  return <div className="mt-4 border-t border-[#edf1ea] pt-4"><button onClick={() => { setOpen(!open); if (!open) void load(); }} className="text-sm font-bold text-[#416949] underline">Заявки в компанию</button>{open ? <div className="mt-3 space-y-2">{items.length ? items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f7faf5] p-3"><div><button onClick={() => api.getUserProfile(item.user.id).then(setProfile).catch((caught) => setError(caught instanceof Error ? caught.message : "Не удалось открыть профиль"))} className="text-left text-sm font-bold underline decoration-dotted underline-offset-4">{item.user.firstName} {item.user.lastName ?? ""}</button><p className="mt-1 text-xs text-[#718075]">{item.message || "Без сообщения"}</p></div><div className="flex gap-2"><button onClick={() => resolve(item.id, "approve")} className="rounded-lg bg-[#102318] px-3 py-2 text-xs font-bold text-[#bdf238]">Принять</button><button onClick={() => resolve(item.id, "reject")} className="rounded-lg border border-[#cfdacd] px-3 py-2 text-xs font-bold">Отклонить</button></div></div>) : <p className="text-sm text-[#718075]">Новых заявок нет.</p>}{profile ? <div className="rounded-xl border border-[#dce5da] bg-white p-4 text-sm"><div className="flex items-start justify-between gap-3"><div><b>{profile.firstName} {profile.lastName ?? ""}</b><p className="mt-1 text-xs text-[#718075]">{profile.city?.name ?? "Город не указан"}</p><p className="mt-2 text-sm text-[#526258]">{profile.about || "Пользователь пока ничего не рассказал о себе."}</p></div><button onClick={() => setProfile(null)} className="text-lg text-[#718075]">×</button></div></div> : null}{error ? <p className="text-xs font-semibold text-[#9e3128]">{error}</p> : null}</div> : null}</div>;
}

function DashboardApplications({ applications }: { applications: Application[] }) {
  const label: Record<Application["status"], string> = { pending: "На рассмотрении", approved: "Одобрено", rejected: "Отклонено", cancelled: "Отменено" };
  return <div className="mt-9"><h2 className="text-2xl font-black">Заявки</h2><div className="mt-5 space-y-3">{applications.length ? applications.map((application) => <div key={application.id} className="flex items-center justify-between gap-4 rounded-2xl border border-[#dce5da] bg-white p-5"><div><h3 className="font-extrabold">Компания #{application.companyId}</h3><p className="mt-1 text-sm text-[#718075]">{application.message || "Без комментария"}</p></div><span className="rounded-full bg-[#eff4ec] px-3 py-1 text-xs font-bold text-[#526258]">{label[application.status]}</span></div>) : <p className="rounded-2xl border border-dashed border-[#cfdacd] bg-white p-7 text-sm text-[#718075]">Заявок пока нет.</p>}</div></div>;
}
