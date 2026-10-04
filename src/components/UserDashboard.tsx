import ForumOutlined from "@mui/icons-material/ForumOutlined"
import PersonOutline from "@mui/icons-material/PersonOutline"
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined"
import GroupsOutlined from "@mui/icons-material/GroupsOutlined"
import NotificationsNoneOutlined from "@mui/icons-material/NotificationsNoneOutlined"
import ArrowOutward from "@mui/icons-material/ArrowOutward"
import EditOutlined from "@mui/icons-material/EditOutlined"
import { useEffect, useState } from "react"
import { api } from "../api"
import type {
  Application,
  Company,
  CompanyUpdate,
  DictionaryItem,
  Event,
  User,
  UserShort,
} from "../api/types"

type Tab = "profile" | "events" | "companies" | "applications"
type Props = {
  user: User
  cities: DictionaryItem[]
  interests: DictionaryItem[]
  onUpdate: (user: User) => void
  onOpenEvent: (event: Event) => void
  onFindEvents: () => void
  onOpenChats: () => void
}
const tabs: Array<[Tab, string]> = [
  ["profile", "Мой профиль"],
  ["events", "Мои события"],
  ["companies", "Мои компании"],
  ["applications", "Заявки"],
]
const tabIcons = { profile: PersonOutline, events: CalendarMonthOutlined, companies: GroupsOutlined, applications: NotificationsNoneOutlined }
const eventLabels: Record<Event["status"], string> = {
  pending: "На модерации",
  active: "Активно",
  rejected: "Отклонено",
  blocked: "Заблокировано",
  completed: "Завершено",
}
const appLabels: Record<Application["status"], string> = {
  pending: "Ожидает решения",
  approved: "Одобрена",
  rejected: "Отклонена",
  cancelled: "Отменена",
}

export default function UserDashboard({
  user,
  cities,
  interests,
  onUpdate,
  onOpenEvent,
  onFindEvents,
  onOpenChats,
}: Props) {
  const [tab, setTab] = useState<Tab>("profile")
  const [events, setEvents] = useState<Event[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null)
  const load = async () => {
    setError("")
    try {
      const [a, b, c] = await Promise.all([
        api.listMyEvents(),
        api.listMyCompanies(),
        api.listMyApplications(),
      ])
      setEvents(a.items)
      setCompanies(b.items)
      setApplications(c.items)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Не удалось обновить данные",
      )
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  const initials = `${user.firstName[0] ?? "П"}${user.lastName?.[0] ?? ""}`;
  const counts = { profile: null, events: events.length, companies: companies.length, applications: applications.filter(item => item.status === "pending").length };
  const empty = (title: string, description: string) => <div className="plans-empty"><CalendarMonthOutlined/><h3>{title}</h3><p>{description}</p><button className="plans-button plans-button--primary" onClick={onFindEvents}>Найти событие <ArrowOutward fontSize="small"/></button></div>;
  return (
    <main className="dashboard-page plans-page mx-auto max-w-[1240px] px-5 py-10 lg:px-8">
      <header className="plans-heading"><div><p className="plans-eyebrow">Ваше личное пространство</p><h1>Мои планы<span>.</span></h1><p>Люди, встречи и всё, что вы собираетесь пережить вместе.</p></div><button className="plans-button plans-button--primary" onClick={onFindEvents}>Найти событие <ArrowOutward fontSize="small"/></button></header>
      <div className="plans-layout">
        <aside className="plans-sidebar">
          <p className="plans-sidebar-caption">Личный кабинет</p>
          <nav aria-label="Разделы моих планов">
            {tabs.map(([id, label]) => {
              const NavIcon = tabIcons[id];
              return <button key={id} aria-current={tab === id ? "page" : undefined} className="plans-nav-item" onClick={() => setTab(id)}>
                <NavIcon fontSize="small"/><span>{label}</span>{counts[id] !== null && <b>{loading ? "—" : counts[id]}</b>}
              </button>;
            })}
          </nav>
          <div className="plans-sidebar-note"><span>Всё начинается с «пойдём».</span><p>Выбирайте событие — и находите тех, кто разделит впечатления.</p></div>
        </aside>
        <section className="plans-content">
          {error && <p role="alert" className="plans-error">{error}</p>}
          {tab === "profile" && <>
            <section className="plans-profile">
              <div className="plans-profile-cover" aria-hidden="true"><span>Встречаемся в реальном мире</span></div>
              <div className="plans-profile-body">
                <div className="plans-profile-top">
                  <div className="plans-avatar">{user.avatarUrl && failedAvatar !== user.avatarUrl ? <img src={user.avatarUrl} alt="Ваше фото" onError={() => setFailedAvatar(user.avatarUrl)}/> : <span>{initials}</span>}</div>
                  <button className="plans-button plans-button--secondary" aria-expanded={editing} onClick={() => setEditing(!editing)}><EditOutlined fontSize="small"/>{editing ? "Закрыть редактор" : "Редактировать"}</button>
                </div>
                <div className="plans-identity"><p className="plans-eyebrow">Мой профиль</p><h2>{user.firstName} {user.lastName}</h2><p className="plans-city">{user.city?.name ?? "Город не указан"}</p></div>
                <p className="plans-about">{user.about || "Расскажите о себе — так будущей компании будет проще познакомиться с вами."}</p>
                {editing ? <ProfileEditor user={user} cities={cities} interests={interests} onUpdate={nextUser => { onUpdate(nextUser); setEditing(false); }}/> : <div className="plans-interests"><p>Мне интересно</p><div>{user.interests.length ? user.interests.map(item => <span key={item.id}>{item.name}</span>) : <button className="plans-text-button" onClick={() => setEditing(true)}>Добавить интересы</button>}</div></div>}
              </div>
            </section>
            <div className="plans-overview">
              {(["events", "companies", "applications"] as const).map(id => {
                const SummaryIcon = tabIcons[id];
                return <button key={id} onClick={() => setTab(id)}><SummaryIcon/><span>{tabs.find(item => item[0] === id)?.[1]}</span><strong>{loading ? "—" : counts[id]}</strong><ArrowOutward className="plans-summary-arrow" fontSize="small"/></button>;
              })}
            </div>
          </>}
          {tab === "events" && <section>
            <div className="plans-section-heading"><div><p className="plans-eyebrow">Ваш календарь впечатлений</p><h2>Мои события</h2></div><span>{loading ? "Загружаем…" : `Всего: ${events.length}`}</span></div>
            {!loading && !error && !events.length && empty("Планы ещё впереди", "Сохраните участие в событии, и оно появится здесь.")}
            <div className="plans-events-grid">{events.map(event => <button className="plans-event" key={event.id} onClick={() => onOpenEvent(event)}>
              <div className="plans-event-image">{event.imageUrl ? <img src={event.imageUrl} alt="" loading="lazy"/> : <CalendarMonthOutlined/>}<span className="plans-status" data-status={event.status}>{eventLabels[event.status]}</span></div>
              <div className="plans-event-body"><time dateTime={event.startsAt}>{new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(event.startsAt))}</time><h3>{event.title}</h3><p>{event.locationName}</p>{event.moderationReason && <p className="plans-error">Причина: {event.moderationReason}</p>}<span className="plans-event-link">Открыть событие <ArrowOutward fontSize="small"/></span></div>
            </button>)}</div>
          </section>}
          {tab === "companies" && <section>
            <div className="plans-section-heading"><div><p className="plans-eyebrow">Те, с кем вы идёте</p><h2>Мои компании</h2></div><span>{loading ? "Загружаем…" : `Всего: ${companies.length}`}</span></div>
            {!loading && !error && !companies.length && empty("Найдите своих людей", "Выберите событие и присоединитесь к компании или создайте свою.")}
            <div className="plans-company-list">{companies.map(company => <CompanyCard key={company.id} company={company} user={user} onChanged={load} onOpenChats={onOpenChats}/>)}</div>
          </section>}
          {tab === "applications" && <section>
            <div className="plans-section-heading"><div><p className="plans-eyebrow">На связи с организаторами</p><h2>Мои заявки</h2></div><span>{loading ? "Загружаем…" : `Всего: ${applications.length}`}</span></div>
            {!loading && !error && !applications.length && empty("Заявок пока нет", "Здесь можно следить за ответами компаний, к которым вы хотите присоединиться.")}
            <div className="plans-company-list">{applications.map(item => <article key={item.id} className="plans-application"><span className="plans-application-icon"><GroupsOutlined/></span><div><h3>{companies.find(company => company.id === item.companyId)?.name ?? `Компания #${item.companyId}`}</h3><span className="plans-status" data-status={item.status}>{appLabels[item.status]}</span></div>{item.status === "pending" && <button className="plans-button plans-button--danger" onClick={async () => { try { await api.cancelMyCompanyApplication(item.companyId); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось отменить заявку"); } }}>Отменить заявку</button>}</article>)}</div>
          </section>}
        </section>
      </div>
    </main>
  );
}

function CompanyCard({
  company,
  user,
  onChanged,
  onOpenChats,
}: {
  company: Company
  user: User
  onChanged: () => Promise<void>
  onOpenChats: () => void
}) {
  const owner = company.owner.id === user.id
  const [manage, setManage] = useState(false)
  const age =
    company.minAge !== null || company.maxAge !== null
      ? ` · возраст ${company.minAge ?? "—"}–${company.maxAge ?? "—"}`
      : ""
  return (
    <article className="plans-company">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="plans-company-heading">
          <p className="plans-eyebrow">{owner ? "Вы организатор" : "Вы участник"}</p>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-extrabold">{company.name}</h3>
            <span
              className="plans-status"
              data-status={company.status}
            >
              {company.status === "active" ? "Набор открыт" : "Набор закрыт"}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#718075]">
            Участников: {company.membersCount}/{company.maxMembers}
            {age}
          </p>
        </div>
        <button
          onClick={onOpenChats}
          aria-label="Открыть чат"
          className="plans-chat-button"
        >
          <ForumOutlined fontSize="small" />
        </button>
      </div>
      {company.description && <p className="plans-company-description">{company.description}</p>}
      <div className="plans-capacity" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, company.membersCount / Math.max(1, company.maxMembers) * 100))}%` }}/></div>
      <div className="mt-4 border-t border-[#edf1ea] pt-4">
        {owner ? (
          <button
            onClick={() => setManage(!manage)}
            aria-expanded={manage}
            className="plans-button plans-button--secondary"
          >
            {manage ? "Закрыть управление" : "Управлять компанией"}
          </button>
        ) : (
          <button
            onClick={async () => {
              if (window.confirm("Выйти из компании?")) {
                await api.leaveCompany(company.id)
                await onChanged()
              }
            }}
            className="plans-button plans-button--danger"
          >
            Выйти из компании
          </button>
        )}
      </div>
      {owner && manage ? (
        <CompanyManager
          company={company}
          onChanged={async () => {
            setManage(false)
            await onChanged()
          }}
        />
      ) : null}
    </article>
  )
}

function CompanyManager({
  company,
  onChanged,
}: {
  company: Company
  onChanged: () => Promise<void>
}) {
  const [draft, setDraft] = useState<CompanyUpdate>({
    name: company.name,
    description: company.description,
    rules: company.rules,
    maxMembers: company.maxMembers,
    joinType: company.joinType,
    minAge: company.minAge,
    maxAge: company.maxAge,
  })
  const [members, setMembers] = useState<UserShort[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [error, setError] = useState("")
  const load = async () => {
    try {
      const [memberList, applicationList] = await Promise.all([
        api.listCompanyMembers(company.id),
        api.listCompanyApplications(company.id),
      ])
      setMembers(memberList.items)
      setApplications(applicationList.items)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось загрузить компанию",
      )
    }
  }
  useEffect(() => {
    void load()
  }, [])
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (
      (draft.minAge != null && (draft.minAge < 14 || draft.minAge > 100)) ||
      (draft.maxAge != null && (draft.maxAge < 14 || draft.maxAge > 100)) ||
      (draft.minAge != null &&
        draft.maxAge != null &&
        draft.minAge > draft.maxAge)
    )
      return setError(
        "Возраст: от 14 до 100 лет; нижняя граница не выше верхней.",
      )
    try {
      await api.updateCompany(company.id, draft)
      await onChanged()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось сохранить компанию",
      )
    }
  }
  const decide = async (id: number, action: "approve" | "reject") => {
    try {
      await api.resolveCompanyApplication(company.id, id, action)
      await load()
      await onChanged()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось обработать заявку",
      )
    }
  }
  return (
    <div className="plans-manager mt-5 rounded-2xl p-4">
      <h4 className="font-extrabold">Управление компанией</h4>
      <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold">
          Название
          <input
            value={draft.name ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
            className="mt-1.5 w-full rounded-lg border border-[#dce5da] px-3 py-2 font-normal"
          />
        </label>
        <label className="text-xs font-bold">
          Лимит участников
          <input
            type="number"
            min={2}
            max={100}
            value={draft.maxMembers ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, maxMembers: Number(event.target.value) })
            }
            className="mt-1.5 w-full rounded-lg border border-[#dce5da] px-3 py-2 font-normal"
          />
        </label>
        <label className="text-xs font-bold">
          Тип вступления
          <select
            value={draft.joinType ?? "open"}
            onChange={(event) =>
              setDraft({
                ...draft,
                joinType: event.target.value as Company["joinType"],
              })
            }
            className="mt-1.5 w-full rounded-lg border border-[#dce5da] px-3 py-2 font-normal"
          >
            <option value="open">Свободное</option>
            <option value="request">По заявке</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-bold">
            Возраст от
            <input
              type="number"
              min={14}
              max={100}
              value={draft.minAge ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  minAge: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-1.5 w-full rounded-lg border border-[#dce5da] px-3 py-2 font-normal"
            />
          </label>
          <label className="text-xs font-bold">
            Возраст до
            <input
              type="number"
              min={14}
              max={100}
              value={draft.maxAge ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  maxAge: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-1.5 w-full rounded-lg border border-[#dce5da] px-3 py-2 font-normal"
            />
          </label>
        </div>
        <label className="sm:col-span-2 text-xs font-bold">
          Описание
          <textarea
            value={draft.description ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, description: event.target.value || null })
            }
            rows={2}
            className="mt-1.5 w-full rounded-lg border border-[#dce5da] px-3 py-2 font-normal"
          />
        </label>
        <label className="sm:col-span-2 text-xs font-bold">
          Правила
          <textarea
            value={draft.rules ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, rules: event.target.value || null })
            }
            rows={2}
            className="mt-1.5 w-full rounded-lg border border-[#dce5da] px-3 py-2 font-normal"
          />
        </label>
        <button className="plans-button plans-button--primary">
          Сохранить
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={async () => {
            try {
              company.status === "active"
                ? await api.closeCompanyRecruitment(company.id)
                : await api.openCompanyRecruitment(company.id)
              await onChanged()
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? caught.message
                  : "Не удалось изменить набор",
              )
            }
          }}
          className="plans-button plans-button--secondary"
        >
          {company.status === "active" ? "Закрыть набор" : "Открыть набор"}
        </button>
        <button
          onClick={async () => {
            if (
              !window.confirm("Удалить компанию? Это действие нельзя отменить.")
            )
              return
            try {
              await api.deleteCompany(company.id)
              await onChanged()
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? caught.message
                  : "Не удалось удалить компанию",
              )
            }
          }}
          className="plans-button plans-button--danger"
        >
          Удалить компанию
        </button>
      </div>
      <section className="mt-5 border-t border-[#dce5da] pt-4">
        <h5 className="font-bold">Участники</h5>
        {members.map((member) => (
          <div
            key={member.id}
            className="mt-2 flex items-center justify-between text-sm"
          >
            <span>
              {member.firstName} {member.lastName ?? ""}
              {member.id === company.owner.id ? " · владелец" : ""}
            </span>
            {member.id !== company.owner.id ? (
              <button
                onClick={async () => {
                  if (!window.confirm("Исключить участника?")) return
                  try {
                    await api.removeCompanyMember(company.id, member.id)
                    await load()
                    await onChanged()
                  } catch (caught) {
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : "Не удалось исключить участника",
                    )
                  }
                }}
                className="text-xs font-bold text-[#9e3128] underline"
              >
                Исключить
              </button>
            ) : null}
          </div>
        ))}
      </section>
      <section className="mt-5 border-t border-[#dce5da] pt-4">
        <h5 className="font-bold">Заявки</h5>
        {applications.length ? (
          applications.map((item) => (
            <div
              key={item.id}
              aria-pressed={interestIds.includes(item.id)}
              className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span>
                {item.user.firstName} {item.user.lastName ?? ""}
                {item.message ? ` — ${item.message}` : ""}
              </span>
              <span className="flex gap-2">
                <button
                  onClick={() => void decide(item.id, "approve")}
                  className="plans-button plans-button--primary"
                >
                  Принять
                </button>
                <button
                  onClick={() => void decide(item.id, "reject")}
                  className="plans-button plans-button--secondary"
                >
                  Отклонить
                </button>
              </span>
            </div>
          ))
        ) : (
          <p className="mt-2 text-sm text-[#718075]">Новых заявок нет.</p>
        )}
      </section>
      {error ? (
        <p role="alert" className="mt-4 text-sm font-semibold text-[#9e3128]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function ProfileEditor({
  user,
  cities,
  interests,
  onUpdate,
}: {
  user: User
  cities: DictionaryItem[]
  interests: DictionaryItem[]
  onUpdate: (user: User) => void
}) {
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName ?? "")
  const [cityId, setCityId] = useState(user.city?.id ?? 0)
  const [about, setAbout] = useState(user.about ?? "")
  const [gender, setGender] = useState<User["gender"]>(user.gender ?? null)
  const [birthDate, setBirthDate] = useState(user.birthDate ?? "")
  const [interestIds, setInterestIds] = useState(
    user.interests.map((item) => item.id),
  )
  const [avatar, setAvatar] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [error, setError] = useState("")
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (birthDate && birthDate > new Date().toISOString().slice(0, 10))
      return setError("Дата рождения не может быть в будущем.")
    try {
      let next = await api.updateMyProfile({
        firstName,
        lastName: lastName || null,
        cityId,
        about: about || null,
        gender,
        birthDate: birthDate || null,
        interestIds,
      })
      if (removeAvatar) {
        await api.deleteMyAvatar()
        next = { ...next, avatarUrl: null }
      } else if (avatar) {
        const photo = await api.uploadMyAvatar(avatar)
        next = { ...next, avatarUrl: photo.avatarUrl }
      }
      onUpdate(next)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось сохранить профиль",
      )
    }
  }
  return (
    <form
      onSubmit={save}
      className="plans-editor mt-7 grid gap-4 border-t border-[#edf1ea] pt-6 sm:grid-cols-2"
    >
      <label className="text-sm font-bold">
        Имя
        <input
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2 font-normal"
        />
      </label>
      <label className="text-sm font-bold">
        Фамилия
        <input
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2 font-normal"
        />
      </label>
      <label className="text-sm font-bold">
        Город
        <select
          value={cityId}
          onChange={(event) => setCityId(Number(event.target.value))}
          className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2 font-normal"
        >
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-bold">
        Пол
        <select
          value={gender ?? ""}
          onChange={(event) =>
            setGender((event.target.value || null) as User["gender"])
          }
          className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2 font-normal"
        >
          <option value="">Не указывать</option>
          <option value="male">Мужской</option>
          <option value="female">Женский</option>
        </select>
      </label>
      <label className="text-sm font-bold">
        Дата рождения
        <input
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
          className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2 font-normal"
        />
      </label>
      <label className="text-sm font-bold">
        Новое фото
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            setAvatar(event.target.files?.[0] ?? null)
            setRemoveAvatar(false)
          }}
          className="mt-2 block w-full text-xs font-normal"
        />
        {user.avatarUrl ? (
          <button
            type="button"
            onClick={() => {
              setRemoveAvatar(true)
              setAvatar(null)
            }}
            className="mt-2 text-xs font-bold text-[#9e3128] underline"
          >
            Удалить текущую аватарку
          </button>
        ) : null}
      </label>
      <label className="sm:col-span-2 text-sm font-bold">
        О себе
        <textarea
          value={about}
          onChange={(event) => setAbout(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2 font-normal"
        />
      </label>
      <div className="sm:col-span-2">
        <p className="text-sm font-bold">Интересы</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {interests.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() =>
                setInterestIds((ids) =>
                  ids.includes(item.id)
                    ? ids.filter((id) => id !== item.id)
                    : [...ids, item.id],
                )
              }
              className={`rounded-full border px-3 py-1 text-xs ${
                interestIds.includes(item.id) ? "bg-[#eff9db]" : ""
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <p className="sm:col-span-2 text-sm text-[#9e3128]">{error}</p>
      ) : null}
      <button className="plans-button plans-button--primary sm:col-span-2">
        Сохранить профиль
      </button>
    </form>
  )
}
