import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { ApiError, type Application, type Company, type DictionaryItem, type Event, type User } from "./api/types";
import EventMap from "./components/EventMap";
import Globe from "./components/Globe";
import UserDashboard from "./components/UserDashboard";
import Onboarding from "./components/Onboarding";
import RegisterModal from "./components/RegisterModal";
import ChatsPage from "./components/ChatsPage";
import EventCreateModal from "./components/EventCreateModalRedesign";
import EventFeed from "./components/EventFeed";
import PageErrorBoundary from "./components/PageErrorBoundary";
import SiteSelect from "./components/SiteSelect";
import BrandLogo from "./components/BrandLogo";
import SocialAuthButtons from "./components/SocialAuthButtons";
import PasswordVisibilityButton from "./components/PasswordVisibilityButton";
import { eventPosition } from "./api/eventPosition";
import { ADMIN_SESSION_KEY } from "./admin/adminSession";

type View = "home" | "feed" | "map" | "profile" | "chats";
type Notice = { kind: "success" | "error"; text: string } | null;
type IconName = "search" | "pin" | "users" | "close" | "arrow" | "check" | "plus" | "sliders";
const publicViews: View[] = ["home", "feed", "map", "profile", "chats"];

function currentViewFromUrl(): View {
  const value = window.location.hash.replace(/^#\/?/, "") as View;
  return publicViews.includes(value) ? value : "home";
}

function queryNumber(name: string) {
  const value = Number(new URLSearchParams(window.location.search).get(name));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>, arrow: <path d="m9 18 6-6-6-6"/>,
    check: <path d="m5 12 4 4L19 6"/>, plus: <path d="M12 5v14M5 12h14"/>,
    sliders: <><path d="M4 6h16M7 12h10M10 18h4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>;
}

const initials = (user: Pick<User, "firstName" | "lastName">) => `${user.firstName[0]}${user.lastName?.[0] ?? ""}`;
const dateLabel = (value: string) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const mockApi = api;

export default function App() {
  const [view, setView] = useState<View>(currentViewFromUrl);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [cities, setCities] = useState<DictionaryItem[]>([]);
  const [categories, setCategories] = useState<DictionaryItem[]>([]);
  const [interests, setInterests] = useState<DictionaryItem[]>([]);
  const [selected, setSelected] = useState<Event | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [joinedCompanyIds, setJoinedCompanyIds] = useState<number[]>([]);
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
  const [cityId, setCityId] = useState(() => queryNumber("cityId"));
  const [categoryId, setCategoryId] = useState(() => queryNumber("categoryId"));
  const [sort, setSort] = useState(() => new URLSearchParams(window.location.search).get("sort") === "popular" ? "popular" : "date");
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [eventCreateOpen, setEventCreateOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const secondaryModalOpen = authOpen || registerOpen || companyOpen || eventCreateOpen;
  const modalOpen = Boolean(selected || secondaryModalOpen || favoritesOpen);

  const flash = (next: Notice) => { setNotice(next); window.setTimeout(() => setNotice(null), 3200); };
  const handleError = (error: unknown) => {
    if (!(error instanceof ApiError)) return flash({ kind: "error", text: "Что-то пошло не так" });
    const messages: Record<string, string> = {
      AGE_RESTRICTION: user?.birthDate ? "Возраст не соответствует условиям этой компании." : "Для этой компании укажите дату рождения в профиле.",
      COMPANY_FULL: "В компании уже нет свободных мест.",
      APPLICATION_ALREADY_EXISTS: "Заявка уже отправлена организатору.",
      ALREADY_IN_EVENT_COMPANY: "Вы уже состоите в компании этого мероприятия.",
      PROFILE_INCOMPLETE: "Сначала заполните профиль.",
      USER_BANNED: "Доступ к аккаунту ограничен.",
    };
    flash({ kind: "error", text: messages[error.code] ?? error.message });
  };

  useEffect(() => {
    Promise.all([api.dictionaries(), api.listEvents()]).then(([dicts, list]) => {
      setCities(dicts.cities); setCategories(dicts.categories); setInterests(dicts.interests); setEvents(list.items);
    }).catch(handleError).finally(() => setLoading(false));
    // A catalogue failure must not prevent restoring the user's session.
    api.getCurrentUser().then(async (currentUser) => {
      setUser(currentUser);
      setJoinedCompanyIds((await api.listMyCompanies()).items.map((company) => company.id));
    }).catch(() => null).finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      api.listEvents({ search, cityId: cityId || undefined, categoryId: categoryId || undefined, sort }).then((list) => setEvents(list.items)).catch(handleError).finally(() => setLoading(false));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [search, cityId, categoryId, sort]);

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [modalOpen]);

  useEffect(() => {
    const syncViewFromUrl = () => { setView(currentViewFromUrl()); setFavoritesOpen(false); };
    window.addEventListener("hashchange", syncViewFromUrl);
    return () => window.removeEventListener("hashchange", syncViewFromUrl);
  }, []);

  useEffect(() => {
    const hash = view === "home" ? "" : `#${view}`;
    if (window.location.hash !== hash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
  }, [view]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (cityId) params.set("cityId", String(cityId));
    if (categoryId) params.set("categoryId", String(categoryId));
    if (sort !== "date") params.set("sort", sort);
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) window.history.replaceState(null, "", nextUrl);
  }, [search, cityId, categoryId, sort]);

  const openEvent = async (event: Event) => {
    setSelected(event); setCompanies([]);
    try { setCompanies((await api.listEventCompanies(event.id)).items); } catch (error) { handleError(error); }
  };
  const authenticate = async (provider: "google" | "telegram" | "vk") => {
    try { const result = await api.login(provider); setUser(result.user); setAuthOpen(false); flash({ kind: "success", text: "Вы вошли в демо-аккаунт" }); } catch (error) { handleError(error); }
  };
  const register = async (provider: "google" | "telegram" | "vk") => {
    try { const result = await api.register(provider); setUser(result.user); setRegisterOpen(false); setView("profile"); } catch (error) { handleError(error); throw error; }
  };
  const registerWithPassword = async (username: string, password: string) => {
    try { const result = await api.registerWithPassword(username, password); setUser(result.user); setRegisterOpen(false); setView("profile"); } catch (error) { handleError(error); throw error; }
  };
  const authenticateAdmin = async (username: string, password: string) => {
    const result = await api.loginWithPassword(username, password);
    if (result.user.role === "admin") {
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ id: result.user.id, fullName: `${result.user.firstName} ${result.user.lastName ?? ""}`.trim(), role: "admin" }));
      window.location.assign("/admin#/");
      return;
    }
    setUser(result.user); setAuthOpen(false); setView(result.user.isProfileComplete ? "home" : "profile");
  };
  const requireAuth = (action: () => void) => user ? action() : setAuthOpen(true);
  const refreshCompanies = async () => selected && setCompanies((await api.listEventCompanies(selected.id)).items);
  const handleCompanyAction = (company: Company) => requireAuth(async () => {
    try {
      if (company.joinType === "open") { await api.joinOpenCompany(company.id); setJoinedCompanyIds((ids) => [...new Set([...ids, company.id])]); flash({ kind: "success", text: `Вы присоединились к «${company.name}»` }); }
      else { await api.createCompanyApplication(company.id, "Буду рад присоединиться к вам!"); flash({ kind: "success", text: "Заявка отправлена организатору" }); }
      await refreshCompanies();
    } catch (error) { handleError(error); }
  });
  const onboardingRequired = Boolean(user && !user.isProfileComplete);

  return <div className="app-shell min-h-screen bg-[#f5f7f2] text-[#102318]">
    <div className="app-background" inert={modalOpen ? true : undefined} aria-hidden={modalOpen || undefined}>
    <Header user={user} view={view} onboarding={onboardingRequired} onNavigate={(next) => { setView(next); setSelected(null); setFavoritesOpen(false); if (next === "home") { setSearch(""); setCityId(0); setCategoryId(0); } }} onAuth={() => setAuthOpen(true)} onRegister={() => setRegisterOpen(true)} onLogout={async () => { await api.logout(); setUser(null); setView("home"); }} />
    <PageErrorBoundary key={`${view}:${user?.id ?? "guest"}`}>
    {!user && (view === "chats" || view === "profile") && <main className="mx-auto max-w-2xl px-5 py-16"><h1 className="text-2xl font-extrabold">{authLoading ? "Загружаем ваш аккаунт…" : "Войдите в аккаунт"}</h1>{!authLoading && <><p className="mt-3 text-[#52705a]">Этот раздел доступен после входа.</p><button onClick={() => setAuthOpen(true)} className="cta-lime mt-6 rounded-xl px-5 py-3 font-bold">Войти</button></>}</main>}
    {onboardingRequired && user ? <Onboarding user={user} cities={cities} interests={interests} onComplete={(nextUser) => { setUser(nextUser); setView("profile"); }} /> : null}
    {!onboardingRequired && view === "home" ? <><HomeHero onNavigate={setView} /><EventsCatalog events={events} cities={cities} categories={categories} cityId={cityId} categoryId={categoryId} search={search} sort={sort} setCityId={setCityId} setCategoryId={setCategoryId} setSearch={setSearch} setSort={setSort} loading={loading} onSelect={openEvent}/></> : null}
    {!onboardingRequired && view === "feed" ? <EventFeed events={events} cities={cities} categories={categories} onOpen={openEvent} favoritesOpen={favoritesOpen} onFavoritesChange={setFavoritesOpen}/> : null}
    {!onboardingRequired && view === "profile" && user ? <UserDashboard user={user} cities={cities} interests={interests} onUpdate={setUser} onOpenEvent={openEvent} onFindEvents={() => setView("map")} onOpenChats={() => setView("chats")} /> : null}
    {!onboardingRequired && view === "chats" && user ? <ChatsPage userId={user.id} /> : null}
    {!onboardingRequired && view === "map" ? <MapPage search={search} setSearch={setSearch} events={events} cities={cities} categories={categories} cityId={cityId} categoryId={categoryId} setCityId={setCityId} setCategoryId={setCategoryId} loading={loading} onSelect={openEvent} onCreate={() => requireAuth(() => setEventCreateOpen(true))} onReset={() => { setSearch(""); setCityId(0); setCategoryId(0); }} /> : null}
    </PageErrorBoundary>
    </div>
    {selected && !secondaryModalOpen && <EventDrawer event={selected} city={cities.find((item) => item.id === selected.cityId)} category={categories.find((item) => item.id === selected.categoryId)} companies={companies} joinedCompanyIds={joinedCompanyIds} onClose={() => setSelected(null)} onJoin={handleCompanyAction} onSolo={() => requireAuth(async () => { try { await mockApi.joinEventSolo(selected.id); flash({ kind: "success", text: "Событие добавлено в ваши планы" }); } catch (error) { handleError(error); } })} onCreate={() => requireAuth(() => setCompanyOpen(true))} />}
    {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onRegister={() => { setAuthOpen(false); setRegisterOpen(true); }} onLogin={authenticate} onAdminLogin={authenticateAdmin} />}
    {registerOpen && <RegisterModal onClose={() => setRegisterOpen(false)} onLogin={() => { setRegisterOpen(false); setAuthOpen(true); }} onRegister={register} onPasswordRegister={registerWithPassword} />}
    {companyOpen && selected && <CreateCompanyModal event={selected} onClose={() => setCompanyOpen(false)} onCreated={async () => { setCompanyOpen(false); await refreshCompanies(); setJoinedCompanyIds((await api.listMyCompanies()).items.map((company) => company.id)); flash({ kind: "success", text: "Компания создана" }); }} />}
    {eventCreateOpen && <EventCreateModal cities={cities} categories={categories} onClose={() => setEventCreateOpen(false)} onCreated={(event) => { setEventCreateOpen(false); flash({ kind: "success", text: `«${event.title}» отправлено на модерацию` }); setView("profile"); }} />}
    {notice && <div role="status" className={`fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-2xl px-5 py-3 text-sm font-semibold shadow-2xl ${notice.kind === "success" ? "bg-[#102318] text-white" : "bg-[#9e3128] text-white"}`}><Icon name={notice.kind === "success" ? "check" : "close"} size={18}/>{notice.text}</div>}
  </div>;
}

function Header({ user, view, onboarding, onNavigate, onAuth, onRegister, onLogout }: { user: User | null; view: View; onboarding: boolean; onNavigate: (view: View) => void; onAuth: () => void; onRegister: () => void; onLogout: () => void }) {
  const [menu, setMenu] = useState(false);
  const navigation: Array<[View, string]> = [["home", "Главная"], ["feed", "Лента"], ["map", "Карта"]];
  if (user && !onboarding) navigation.push(["profile", "Мои планы"], ["chats", "Мои чаты"]);

  return <header className="site-header sticky top-0 z-40">
    <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
      <BrandLogo onClick={() => onNavigate("home")}/>
      <nav aria-label="Основная навигация" className="site-nav hidden items-center gap-1 rounded-2xl p-1 md:flex">
        {navigation.map(([target, label]) => <button key={target} onClick={() => onNavigate(target)} className={`site-nav-link rounded-xl px-4 py-2 text-sm font-bold ${view === target ? "site-nav-link--active" : ""}`}>{label}</button>)}
      </nav>
      {user && !onboarding ? <div className="flex items-center gap-2">
        {user.role === "admin" ? <button onClick={() => window.location.assign("/admin#/")} className="hidden rounded-xl bg-[#102318] px-4 py-2.5 text-sm font-extrabold text-[#dff8a1] shadow-sm transition hover:bg-[#24462d] sm:block">Админка</button> : null}
        <div className="relative"><button onClick={() => setMenu(!menu)} className="profile-trigger flex items-center gap-3 rounded-2xl py-1.5 pl-2 pr-3"><span className="grid h-8 w-8 place-items-center overflow-hidden rounded-xl bg-[#dff8a1] text-xs font-extrabold">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover"/> : initials(user)}</span><span className="hidden text-sm font-semibold sm:block">{user.firstName}</span></button>{menu && <div className="menu-popover absolute right-0 top-12 w-44 rounded-2xl p-2 shadow-xl"><button onClick={() => { onNavigate("profile"); setMenu(false); }} className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[#f1f5ee]">Профиль</button>{user.role === "admin" ? <button onClick={() => window.location.assign("/admin#/")} className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[#f1f5ee]">Админ-панель</button> : null}<button onClick={onLogout} className="w-full rounded-xl px-3 py-2 text-left text-sm text-[#9e3128] hover:bg-[#fff1ef]">Выйти</button></div>}</div>
      </div> : !user ? <div className="flex items-center gap-2"><button onClick={onAuth} className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#24462d]">Войти</button><button onClick={onRegister} className="cta-lime rounded-xl px-4 py-2.5 text-sm font-extrabold text-[#102318]">Создать аккаунт</button></div> : <div className={`site-header-actions-placeholder${user.role === "admin" ? " site-header-actions-placeholder--admin" : ""}`} aria-hidden="true" inert />}
    </div>
  </header>;
}

function HomeHero({ onNavigate }: { onNavigate: (view: View) => void }) {
  return <main><section className="hero-section relative">
    <div className="hero-grain absolute inset-0"/><div className="hero-orb absolute -right-24 -top-36 h-[460px] w-[460px] rounded-full"/>
    <div className="relative mx-auto grid max-w-[1240px] items-center gap-8 px-5 py-6 sm:py-8 lg:grid-cols-[1.04fr_.96fr] lg:px-8 lg:py-12">
      <div className="hero-copy relative z-10 px-1 py-8 sm:px-5 lg:py-12"><p className="hero-kicker mb-7 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold"><span className="h-2 w-2 rounded-full bg-[#bdf238]"/>Новая афиша вашего города</p><h1 className="max-w-2xl text-4xl font-black leading-[.98] tracking-[-.068em] text-white sm:text-5xl lg:text-[4.7rem]">Не просто <span className="hero-accent">куда.</span><br/>А с кем пойти.</h1><p className="mt-7 max-w-lg text-base leading-7 text-[#c2d2c4]">Собираем людей вокруг настоящих планов: от концерта во дворе до выставки, о которой хочется говорить всю ночь.</p><div className="mt-9 flex flex-wrap gap-3"><a href="#events" className="cta-lime rounded-xl px-5 py-3.5 text-sm font-extrabold">Найти событие</a><button onClick={() => onNavigate("map")} className="hero-ghost rounded-xl px-5 py-3.5 text-sm font-extrabold">Смотреть на карте</button></div><div className="hero-proof mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-[#b7c9b9]"><span>Реальные люди</span><span>Живые события</span><span>Свои компании</span></div></div>
      <div className="hero-globe relative min-h-[355px] sm:min-h-[410px]"><Globe/></div>
    </div>
  </section></main>;
}

function EventsCatalog({ events, cities, categories, cityId, categoryId, search, sort, setCityId, setCategoryId, setSearch, setSort, loading, onSelect }: { events: Event[]; cities: DictionaryItem[]; categories: DictionaryItem[]; cityId: number; categoryId: number; search: string; sort: string; setCityId: (id: number) => void; setCategoryId: (id: number) => void; setSearch: (value: string) => void; setSort: (value: string) => void; loading: boolean; onSelect: (event: Event) => void }) {
  const reset = () => { setCityId(0); setCategoryId(0); setSearch(""); };
  return <main><section id="events" className="mx-auto max-w-[1240px] px-5 pb-24 pt-10 lg:px-8"><div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#69916f]">Афиша</p><h2 className="text-3xl font-extrabold tracking-[-.04em] md:text-4xl">Выберите, куда пойдём</h2></div><div className="flex flex-wrap items-center gap-3"><div className="flex items-center gap-2 text-sm text-[#58705e]"><span>Сначала</span><SiteSelect value={sort} onChange={setSort} ariaLabel="Сортировка событий" className="w-40" options={[{ value: "date", label: "Ближайшие" }, { value: "popular", label: "Популярные" }]}/></div></div></div><div className="grid gap-8 lg:grid-cols-[250px_1fr]"><FilterPanel cities={cities} categories={categories} cityId={cityId} categoryId={categoryId} setCityId={setCityId} setCategoryId={setCategoryId}/><div><div className="mb-5 flex items-center justify-between"><p className="text-sm text-[#6d7e70]">Найдено: <b className="text-[#102318]">{events.length}</b></p>{(cityId || categoryId || search) ? <button onClick={reset} className="text-sm font-semibold text-[#416949]">Сбросить фильтры</button> : null}</div>{loading ? <EventSkeletons/> : events.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{events.map((event) => <EventCard key={event.id} event={event} city={cities.find((item) => item.id === event.cityId)} category={categories.find((item) => item.id === event.categoryId)} onClick={() => onSelect(event)}/>)}</div> : <EmptyState onReset={reset}/>}</div></div></section></main>;
}

function MapPage({ search, setSearch, events, cities, categories, cityId, categoryId, setCityId, setCategoryId, loading, onSelect, onCreate, onReset }: { search: string; setSearch: (value: string) => void; events: Event[]; cities: DictionaryItem[]; categories: DictionaryItem[]; cityId: number; categoryId: number; setCityId: (id: number) => void; setCategoryId: (id: number) => void; loading: boolean; onSelect: (event: Event) => void; onCreate: () => void; onReset: () => void }) {
  const locatedCount = events.filter(event => eventPosition(event) !== null).length;
  const filtered = Boolean(cityId || categoryId || search);
  return <main className="map-page atlas-page mx-auto max-w-[1240px] px-5 pb-24 pt-10 lg:px-8">
    <header className="atlas-heading"><div><p className="atlas-eyebrow">Город — это повод встретиться</p><h1>Ваши планы на карте<span>.</span></h1><p>Найдите интересное место. А вместе с ним — свою компанию.</p></div><span className="atlas-heading-icon" aria-hidden="true"><Icon name="pin" size={28}/></span></header>
    <div className="atlas-layout">
      <aside className="atlas-filters">
        <div className="atlas-filter-heading"><Icon name="sliders" size={18}/><h2>Ваш маршрут</h2></div>
        <label className="atlas-label" htmlFor="atlas-search">Что ищем?</label>
        <div className="atlas-search"><Icon name="search" size={18}/><input id="atlas-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Событие или площадка"/></div>
        <label className="atlas-label" htmlFor="atlas-city">Город</label>
        <SiteSelect id="atlas-city" value={cityId} onChange={(value) => setCityId(Number(value))} options={[{ value: 0, label: "Все города" }, ...cities.map((city) => ({ value: city.id, label: city.name }))]}/>
        <fieldset className="atlas-categories"><legend className="atlas-label">По настроению</legend><div><button aria-pressed={!categoryId} onClick={() => setCategoryId(0)}>Все события</button>{categories.map(category => <button key={category.id} aria-pressed={categoryId === category.id} onClick={() => setCategoryId(categoryId === category.id ? 0 : category.id)}>{category.name}</button>)}</div></fieldset>
        {filtered && <button className="atlas-reset" onClick={onReset}>Сбросить фильтры <Icon name="close" size={14}/></button>}
        <p className="atlas-filter-hint">Нажмите на метку с обложкой, чтобы узнать о событии и найти компанию.</p>
      </aside>
      <div className="atlas-results">
        <section className="atlas-map-frame" aria-label="События на карте">
          <div className="atlas-map-toolbar"><span><i aria-hidden="true"/>Карта событий</span><b>{loading ? "Загружаем…" : `${locatedCount} событий`}</b></div>
          {loading ? <div role="status" className="atlas-map-loading">Загружаем карту событий…</div> : <EventMap events={events} onSelect={onSelect}/>}
          <div className="atlas-map-caption"><span>Точки на карте — ваши будущие впечатления</span><button type="button" onClick={onCreate} className="event-create-trigger"><Icon name="plus" size={18}/><span>Создать событие</span></button></div>
        </section>
        {!loading && <MapRecommendations events={events} cities={cities} categories={categories} onSelect={onSelect}/>}
        {!loading && !events.length && <section className="atlas-empty"><Icon name="search" size={28}/><h2>Здесь пока тихо</h2><p>Попробуйте другой город, категорию или поисковый запрос.</p><button onClick={onReset}>Показать все события</button></section>}
      </div>
    </div>
  </main>;
}

function MapRecommendations({ events, cities, categories, onSelect }: { events: Event[]; cities: DictionaryItem[]; categories: DictionaryItem[]; onSelect: (event: Event) => void }) {
  if (!events.length) return null;
  return <section className="atlas-picks"><div className="atlas-picks-heading"><div><p className="atlas-eyebrow">От точки к впечатлению</p><h2>В вашей подборке</h2></div><span>{events.length} событий</span></div>
    <div className="atlas-cards">{events.map(event => <button key={event.id} onClick={() => onSelect(event)} className="atlas-card">
      <div className="atlas-card-cover">{event.imageUrl ? <img src={event.imageUrl} alt="" loading="lazy"/> : <span className="atlas-cover-placeholder"><Icon name="pin" size={32}/></span>}<span className="atlas-card-category">{categories.find(category => category.id === event.categoryId)?.name ?? "Событие"}</span></div>
      <div className="atlas-card-body"><time dateTime={event.startsAt}>{dateLabel(event.startsAt)}</time><h3>{event.title}</h3><p className="atlas-card-place"><Icon name="pin" size={15}/><span>{[cities.find(city => city.id === event.cityId)?.name, event.locationName].filter(Boolean).join(" · ")}</span></p><div className="atlas-card-bottom"><span><Icon name="users" size={16}/>{event.companiesCount} компаний</span><span className="atlas-card-arrow"><Icon name="arrow" size={18}/></span></div></div>
    </button>)}</div>
  </section>;
}

function FilterPanel({ cities, categories, cityId, categoryId, setCityId, setCategoryId }: { cities: DictionaryItem[]; categories: DictionaryItem[]; cityId: number; categoryId: number; setCityId: (id: number) => void; setCategoryId: (id: number) => void }) {
  return <aside className="h-fit rounded-3xl border border-[#dce5da] bg-white p-5 lg:sticky lg:top-24"><div className="mb-5 flex items-center gap-2 font-bold"><Icon name="sliders" size={18}/>Фильтры</div><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#7e8e80]">Город</label><SiteSelect value={cityId} onChange={(value) => setCityId(Number(value))} className="mb-6" options={[{ value: 0, label: "Все города" }, ...cities.map((city) => ({ value: city.id, label: city.name }))]}/><p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#7e8e80]">Тематика</p><div className="flex flex-wrap gap-2 lg:flex-col">{categories.map((category) => <button key={category.id} onClick={() => setCategoryId(categoryId === category.id ? 0 : category.id)} className={`rounded-xl px-3 py-2 text-left text-sm font-medium transition ${categoryId === category.id ? "bg-[#102318] text-white" : "bg-[#f1f5ee] text-[#4e6253] hover:bg-[#e5eee1]"}`}>{category.name}</button>)}</div></aside>;
}

function EventCard({ event, city, category, onClick }: { event: Event; city?: DictionaryItem; category?: DictionaryItem; onClick: () => void }) {
  return <article className="event-card group relative overflow-hidden"><button onClick={onClick} aria-label={`Открыть событие: ${event.title}`} className="block w-full text-left"><div className="event-card-image relative overflow-hidden"><img src={event.imageUrl ?? ""} alt={`Обложка события «${event.title}»`} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.07]"/><div className="event-card-wash absolute inset-0"/><span className="event-card-category absolute left-4 top-4 rounded-full px-3 py-1.5 text-xs font-extrabold">{category?.name ?? "Событие"}</span><div className="event-card-date absolute bottom-0 left-4 translate-y-1/2 rounded-2xl px-3 py-2"><strong className="block text-sm leading-none">{new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(event.startsAt))}</strong><span className="mt-1 block text-[10px] font-bold uppercase tracking-[.1em]">{new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(new Date(event.startsAt))}</span></div></div><div className="event-card-body px-5 pb-5 pt-9"><div className="mb-3 flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[.1em] text-[#738879]"><span className="truncate">{city?.name ?? "Город"}</span><span className="shrink-0 text-[#45654c]">{event.participantsCount} идут</span></div><h3 className="event-card-title text-[1.24rem] font-extrabold leading-[1.15] tracking-[-.04em] text-[#102318]">{event.title}</h3><p className="event-card-description mt-2 text-sm leading-6 text-[#617365]">{event.description || "Собираемся вместе, чтобы провести время и найти свою компанию."}</p><div className="mt-4 flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2 text-xs leading-5 text-[#617365]"><Icon name="pin" size={15}/><span className="truncate">{event.locationName}</span></span><span className="event-card-arrow grid h-10 w-10 shrink-0 place-items-center rounded-2xl"><Icon name="arrow" size={18}/></span></div><div className="event-card-footer mt-4 flex items-center gap-2 border-t pt-4 text-xs font-semibold text-[#46634c]"><Icon name="users" size={16}/><span>{event.companiesCount ? `${event.companiesCount} компаний собираются` : "Создайте первую компанию"}</span></div></div></button></article>;
}

function EventDrawer({ event, city, category, companies: allCompanies, joinedCompanyIds, onClose, onJoin, onSolo, onCreate }: { event: Event; city?: DictionaryItem; category?: DictionaryItem; companies: Company[]; joinedCompanyIds: number[]; onClose: () => void; onJoin: (company: Company) => void; onSolo: () => void; onCreate: () => void }) {
  const companies = allCompanies.filter((company) => company.status === "active" && company.membersCount < company.maxMembers);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, [onClose]);

  return <div className="event-modal-overlay" onMouseDown={(mouseEvent) => mouseEvent.target === mouseEvent.currentTarget && onClose()}>
    <section className="event-modal-panel" role="dialog" aria-modal="true" aria-labelledby={`event-modal-title-${event.id}`}>
      <div className="event-modal-cover">
        {event.imageUrl ? <img src={event.imageUrl} alt={`Обложка события «${event.title}»`}/> : <div className="event-modal-cover-placeholder"><Icon name="pin" size={42}/></div>}
        <div className="event-modal-cover-shade"/>
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Закрыть карточку события" className="event-modal-close"><Icon name="close" size={21}/></button>
        <div className="event-modal-cover-meta">
          <span>{category?.name ?? "Событие"}</span>
          <time dateTime={event.startsAt}>{dateLabel(event.startsAt)}</time>
        </div>
      </div>

      <div className="event-modal-body">
        <header className="event-modal-header">
          <p>План, который стоит разделить</p>
          <h2 id={`event-modal-title-${event.id}`}>{event.title}</h2>
        </header>

        <div className="event-modal-facts">
          <div><span className="event-modal-fact-icon"><Icon name="pin" size={19}/></span><span><small>Место</small><strong>{[city?.name, event.locationName].filter(Boolean).join(" · ")}</strong></span></div>
          <div><span className="event-modal-fact-icon"><Icon name="users" size={19}/></span><span><small>Уже собираются</small><strong>{event.participantsCount} участников</strong></span></div>
        </div>

        {event.description ? <p className="event-modal-description">{event.description}</p> : null}

        <div className="event-modal-actions">
          <button type="button" onClick={onSolo} className="event-modal-action-primary"><Icon name="check" size={19}/>Пойду самостоятельно</button>
          <button type="button" onClick={onCreate} className="event-modal-action-secondary"><Icon name="plus" size={19}/>Создать компанию</button>
        </div>

        <section className="event-modal-companies" aria-labelledby={`event-companies-title-${event.id}`}>
          <div className="event-modal-section-heading">
            <div><p>Компании участников</p><h3 id={`event-companies-title-${event.id}`}>Идём вместе</h3></div>
            <span>{companies.length}</span>
          </div>

          <div className="event-modal-company-list">
            {companies.length ? companies.map((company) => {
              const rawMinAge = Number(company.minAge);
              const rawMaxAge = Number(company.maxAge);
              const minAge = Number.isFinite(rawMinAge) && rawMinAge > 0 ? rawMinAge : null;
              const maxAge = Number.isFinite(rawMaxAge) && rawMaxAge > 0 ? rawMaxAge : null;
              const ageLabel = minAge && maxAge ? `${minAge}–${maxAge} лет` : minAge ? `От ${minAge} лет` : maxAge ? `До ${maxAge} лет` : "Без ограничений";
              const capacity = Math.min(100, Math.round((company.membersCount / Math.max(company.maxMembers, 1)) * 100));
              return <article key={company.id} className="event-modal-company">
                <div className="event-modal-company-top">
                  <div className="event-modal-company-copy"><span className="event-modal-company-kicker">Компания</span><h4>{company.name}</h4><p>{company.description}</p></div>
                  <div className="event-modal-company-capacity"><span><strong>{company.membersCount}</strong> из {company.maxMembers}</span><div aria-label={`Заполнено на ${capacity}%`}><i style={{ width: `${capacity}%` }}/></div></div>
                </div>
                <div className="event-modal-company-tags">
                  <span><Icon name={company.joinType === "open" ? "check" : "users"} size={13}/>{company.joinType === "open" ? "Свободный вход" : "Вход по заявке"}</span>
                  <span>{ageLabel}</span>
                </div>
                <footer>
                  <div className="event-modal-company-owner"><span>{company.owner.firstName.charAt(0)}</span><div><small>Организатор</small><strong>{company.owner.firstName}</strong></div></div>
                  {joinedCompanyIds.includes(company.id)
                    ? <span className="event-modal-joined"><Icon name="check" size={15}/>Вы в компании</span>
                    : <button type="button" onClick={() => onJoin(company)}>{company.joinType === "open" ? "Присоединиться" : "Отправить заявку"}<Icon name="arrow" size={16}/></button>}
                </footer>
              </article>;
            }) : <div className="event-modal-empty"><span><Icon name="users" size={24}/></span><div><strong>Здесь пока свободно</strong><p>Создайте первую компанию и найдите людей с такими же планами.</p></div><button type="button" onClick={onCreate}>Создать</button></div>}
          </div>
        </section>
      </div>
    </section>
  </div>;
}

function AuthModal({ onClose, onRegister, onLogin, onAdminLogin }: { onClose: () => void; onRegister: () => void; onLogin: (provider: "google" | "telegram" | "vk") => void; onAdminLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const submitAdmin = async (event: FormEvent) => {
    event.preventDefault(); setAdminError(""); setAdminLoading(true);
    try { await onAdminLogin(username, password); }
    catch (error) { setAdminError(error instanceof Error ? error.message : "Не удалось войти"); setAdminLoading(false); }
  };
  return <div className="auth-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="login-title">
    <button type="button" onClick={onClose} aria-label="Закрыть окно входа" className="auth-close"><Icon name="close" size={19}/></button>
    <BrandLogo/>
    <header className="auth-heading"><p>Ваши планы уже рядом</p><h2 id="login-title">С возвращением</h2><span>Войдите, чтобы продолжить искать события и людей, с которыми хочется пойти.</span></header>
    <SocialAuthButtons onSelect={onLogin}/>
    <div className="auth-divider"><span/>или по логину<span/></div>
    <form onSubmit={submitAdmin} className="auth-form">
      <label><span>Логин</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required placeholder="Введите логин"/></label>
      <label><span>Пароль</span><div className="auth-password"><input autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Введите пароль"/><PasswordVisibilityButton visible={showPassword} onToggle={() => setShowPassword((value) => !value)}/></div></label>
      {adminError ? <p role="alert" className="auth-error">{adminError}</p> : null}
      <button disabled={adminLoading} className="auth-submit">{adminLoading ? "Проверяем…" : "Войти"}</button>
    </form>
    <p className="auth-switch">Ещё нет аккаунта? <button type="button" onClick={onRegister}>Создать аккаунт</button></p>
  </section></div>;
}

function PolicyModal({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-[#08130d]/60 p-5 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><article className="max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#6d8b73]">«Пойдём»</p><h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Правила и политика безопасного участия</h2></div><button type="button" onClick={onClose} aria-label="Закрыть правила" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eff4ec] text-[#526258]"><Icon name="close"/></button></div><div className="mt-6 space-y-5 text-sm leading-6 text-[#526258]"><section><h3 className="font-extrabold text-[#102318]">1. О платформе</h3><p className="mt-1">«Пойдём» помогает пользователям находить мероприятия и объединяться в компании. Мы не выступаем организатором мероприятий, перевозчиком, охраной, посредником при оплате или представителем участников.</p></section><section><h3 className="font-extrabold text-[#102318]">2. Самостоятельное решение</h3><p className="mt-1">Каждый пользователь самостоятельно выбирает событие, оценивает место, программу, организатора и участников, а также принимает решение об участии. До встречи рекомендуем уточнить детали у организатора и не передавать незнакомым людям личные данные, деньги или документы.</p></section><section><h3 className="font-extrabold text-[#102318]">3. Ответственность на мероприятии</h3><p className="mt-1">За содержание, проведение, изменения программы и безопасность конкретного мероприятия отвечает его организатор. За собственные действия и соблюдение закона на мероприятии отвечает каждый участник. Платформа не может гарантировать поведение, намерения, достоверность информации или совместимость других пользователей и не несёт ответственности за события и отношения, возникающие между участниками вне функциональности платформы, в пределах, допустимых применимым законодательством.</p></section><section><h3 className="font-extrabold text-[#102318]">4. Безопасность</h3><p className="mt-1">Если встреча вызывает сомнения, не продолжайте общение и сообщите о пользователе или событии через жалобу. При непосредственной угрозе жизни, здоровью или имуществу обращайтесь в экстренные службы, а затем сообщите нам — мы рассмотрим жалобу и можем ограничить доступ нарушителю.</p></section><section><h3 className="font-extrabold text-[#102318]">5. Уважительное общение</h3><p className="mt-1">Запрещены угрозы, преследование, дискриминация, мошенничество, публикация чужих персональных данных и размещение незаконного контента. Мы вправе модерировать или блокировать материалы и аккаунты при нарушении правил.</p></section></div><button type="button" onClick={onClose} className="mt-7 w-full rounded-xl bg-[#102318] py-3 text-sm font-extrabold text-white">Понятно</button></article></div>;
}

function CreateCompanyModal({ event, onClose, onCreated }: { event: Event; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [maxMembers, setMaxMembers] = useState(5); const [joinType, setJoinType] = useState<"open" | "request">("open"); const [minAge, setMinAge] = useState(""); const [maxAge, setMaxAge] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submit = async (e: FormEvent) => { e.preventDefault(); const min = minAge ? Number(minAge) : null; const max = maxAge ? Number(maxAge) : null; if ((min !== null && (min < 14 || min > 100)) || (max !== null && (max < 14 || max > 100)) || (min !== null && max !== null && min > max)) { setError("Возраст указывается от 14 до 100 лет; нижняя граница не может быть выше верхней."); return; } setSaving(true); try { await api.createCompany(event.id, { name, description: description || null, maxMembers, joinType, minAge: min, maxAge: max }); onCreated(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось создать компанию"); } finally { setSaving(false); } };
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-[#08130d]/55 p-5 backdrop-blur-sm"><form onSubmit={submit} className="relative w-full max-w-lg rounded-[30px] bg-white p-7 shadow-2xl"><button type="button" onClick={onClose} className="absolute right-5 top-5 text-[#718075]"><Icon name="close"/></button><p className="pr-8 text-xs font-bold uppercase tracking-wider text-[#78907d]">{event.title}</p><h2 className="mt-2 text-2xl font-black">Создать компанию</h2><div className="mt-6 space-y-4"><label className="block text-sm font-semibold">Название<input autoFocus value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} className="mt-2 w-full rounded-xl border border-[#dce4da] px-4 py-3 font-normal"/></label><label className="block text-sm font-semibold">Описание<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[#dce4da] px-4 py-3 font-normal"/></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Участников<input type="number" min={2} max={100} value={maxMembers} onChange={(e) => setMaxMembers(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-[#dce4da] px-4 py-3 font-normal"/></label><label className="text-sm font-semibold">Вступление<SiteSelect value={joinType} onChange={(value) => setJoinType(value as "open" | "request")} className="mt-2 font-normal" options={[{ value: "open", label: "Свободное" }, { value: "request", label: "По заявке" }]}/></label></div><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Возраст от<input type="number" min={14} max={100} value={minAge} onChange={(e) => setMinAge(e.target.value)} placeholder="Без ограничения" className="mt-2 w-full rounded-xl border border-[#dce4da] px-4 py-3 font-normal"/></label><label className="text-sm font-semibold">Возраст до<input type="number" min={14} max={100} value={maxAge} onChange={(e) => setMaxAge(e.target.value)} placeholder="Без ограничения" className="mt-2 w-full rounded-xl border border-[#dce4da] px-4 py-3 font-normal"/></label></div></div>{error && <p role="alert" className="mt-4 text-sm text-[#a33a31]">{error}</p>}<button disabled={saving} className="mt-6 w-full rounded-2xl bg-[#bdf238] py-3.5 text-sm font-extrabold">{saving ? "Создаём…" : "Создать компанию"}</button></form></div>;
}

function Profile({ user, cities, onUpdate, onOpenEvent }: { user: User; cities: DictionaryItem[]; onUpdate: (user: User) => void; onOpenEvent: (event: Event) => void }) {
  const [events, setEvents] = useState<Event[]>([]); const [companies, setCompanies] = useState<Company[]>([]); const [applications, setApplications] = useState<Application[]>([]); const [editing, setEditing] = useState(false); const [about, setAbout] = useState(user.about ?? "");
  useEffect(() => { Promise.all([mockApi.listMyEvents(), mockApi.listMyCompanies(), mockApi.listMyApplications()]).then(([ev, co, ap]) => { setEvents(ev.items); setCompanies(co.items); setApplications(ap.items); }); }, []);
  return <main className="mx-auto max-w-[1100px] px-5 py-12 lg:px-8"><section className="rounded-[32px] bg-[#102318] p-7 text-white sm:p-9"><div className="flex flex-col gap-6 sm:flex-row sm:items-center"><div className="grid h-24 w-24 shrink-0 place-items-center rounded-[28px] bg-[#bdf238] text-3xl font-black text-[#102318]">{initials(user)}</div><div className="flex-1"><p className="text-sm text-[#9db2a3]">{user.city?.name}</p><h1 className="mt-1 text-3xl font-black tracking-[-.04em]">{user.firstName} {user.lastName}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#b8c8bc]">{user.about}</p><div className="mt-4 flex flex-wrap gap-2">{user.interests.map((item) => <span key={item.id} className="rounded-full bg-white/10 px-3 py-1 text-xs text-[#dce8de]">{item.name}</span>)}</div></div><button onClick={() => setEditing(!editing)} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10">{editing ? "Закрыть" : "Редактировать"}</button></div>{editing && <form onSubmit={async (e) => { e.preventDefault(); const next = await mockApi.updateMyProfile({ about }); onUpdate(next); setEditing(false); }} className="mt-7 border-t border-white/10 pt-6"><label className="text-sm font-semibold">О себе<textarea value={about} onChange={(e) => setAbout(e.target.value)} className="mt-2 block w-full max-w-2xl rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm outline-none" rows={3}/></label><button className="mt-3 rounded-xl bg-[#bdf238] px-5 py-2.5 text-sm font-bold text-[#102318]">Сохранить</button></form>}</section>
    <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]"><section><p className="text-xs font-bold uppercase tracking-[.18em] text-[#78907d]">Ближайшие планы</p><h2 className="mt-2 text-2xl font-black">Мои события</h2>{events.length ? <div className="mt-5 space-y-3">{events.map((event) => <button key={event.id} onClick={() => onOpenEvent(event)} className="flex w-full items-center gap-4 rounded-2xl border border-[#dfe7dc] bg-white p-3 text-left hover:shadow-md"><img src={event.imageUrl ?? ""} className="h-20 w-24 rounded-xl object-cover" alt=""/><div><p className="text-xs font-bold text-[#64806a]">{dateLabel(event.startsAt)}</p><h3 className="mt-1 font-extrabold">{event.title}</h3><p className="mt-1 text-xs text-[#718075]">{cities.find((city) => city.id === event.cityId)?.name}</p></div><span className="ml-auto mr-2"><Icon name="arrow"/></span></button>)}</div> : <MiniEmpty text="Событий пока нет — самое время выбрать первое"/>}</section><aside className="space-y-5"><Stats events={events.length} companies={companies.length} applications={applications.length}/><div className="rounded-3xl border border-[#dfe7dc] bg-white p-5"><h3 className="font-extrabold">Мои заявки</h3>{applications.length ? <div className="mt-4 space-y-3">{applications.map((app) => <div key={app.id} className="flex items-center justify-between gap-2 text-sm"><span className="text-[#627166]">Компания #{app.companyId}</span><Status status={app.status}/></div>)}</div> : <p className="mt-3 text-sm leading-6 text-[#7a897d]">Активных заявок пока нет.</p>}</div><button onClick={() => mockApi.reset()} className="w-full text-center text-xs text-[#8c9a8f] underline decoration-dotted">Сбросить демо-данные</button></aside></div>
  </main>;
}

function Stats({ events, companies, applications }: { events: number; companies: number; applications: number }) { return <div className="grid grid-cols-3 gap-2 rounded-3xl bg-[#e9f1e5] p-4 text-center">{[[events,"событий"],[companies,"компаний"],[applications,"заявок"]].map(([value,label]) => <div key={label}><b className="text-2xl font-black">{value}</b><p className="mt-1 text-[10px] uppercase tracking-wide text-[#718075]">{label}</p></div>)}</div>; }
function Status({ status }: { status: Application["status"] }) { const labels = { pending: "На рассмотрении", approved: "Одобрено", rejected: "Отклонено", cancelled: "Отменено" }; return <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${status === "approved" ? "bg-[#e7f7c2] text-[#476b10]" : status === "pending" ? "bg-[#fff3cc] text-[#80620d]" : "bg-[#f5e7e5] text-[#8c3b34]"}`}>{labels[status]}</span>; }
function MiniEmpty({ text }: { text: string }) { return <div className="mt-5 rounded-2xl border border-dashed border-[#ccd8ca] bg-white p-8 text-center text-sm text-[#7b897e]">{text}</div>; }
function EventSkeletons() { return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[1,2,3,4,5,6].map((n) => <div key={n} className="animate-pulse overflow-hidden rounded-3xl border border-[#e1e8df] bg-white"><div className="h-44 bg-[#e4ebe1]"/><div className="space-y-3 p-5"><div className="h-3 w-24 rounded bg-[#e4ebe1]"/><div className="h-5 w-4/5 rounded bg-[#e4ebe1]"/><div className="h-3 w-2/3 rounded bg-[#e4ebe1]"/></div></div>)}</div>; }
function EmptyState({ onReset }: { onReset: () => void }) { return <div className="rounded-3xl border border-dashed border-[#cbd8c9] bg-white px-6 py-20 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#ecf3e8] text-[#56705d]"><Icon name="search"/></span><h3 className="mt-5 text-xl font-extrabold">Ничего не нашли</h3><p className="mt-2 text-sm text-[#748278]">Попробуйте изменить запрос или убрать фильтры.</p><button onClick={onReset} className="mt-5 rounded-xl bg-[#102318] px-4 py-2.5 text-sm font-bold text-white">Сбросить фильтры</button></div>; }
