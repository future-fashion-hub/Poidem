import ForumOutlined from "@mui/icons-material/ForumOutlined"
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
  const load = async () => {
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
    }
  }
  useEffect(() => {
    void load()
  }, [])
  const avatar = user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt="Аватар пользователя"
      className="h-full w-full object-cover"
    />
  ) : (
    <span>{`${user.firstName[0] ?? "П"}${user.lastName?.[0] ?? ""}`}</span>
  )
  return (
    <main className="mx-auto max-w-[1240px] px-5 py-10 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
        <aside className="h-fit rounded-3xl border border-[#dce5da] bg-white p-3 lg:sticky lg:top-24">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`mb-1 w-full rounded-2xl px-4 py-3 text-left text-sm font-bold ${
                tab === id
                  ? "bg-[#e7f8c9] text-[#21462e]"
                  : "text-[#526258] hover:bg-[#f2f6ef]"
              }`}
            >
              {label}
            </button>
          ))}
        </aside>
        <section>
          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-[#fff0ed] px-4 py-3 text-sm font-semibold text-[#9e3128]"
            >
              {error}
            </p>
          ) : null}
          {tab === "profile" ? (
            <>
              <div className="rounded-[30px] border border-[#dce5da] bg-white p-6 sm:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[24px] bg-[#bdf238] text-2xl font-black text-[#102318]">
                    {avatar}
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl font-black">
                      {user.firstName} {user.lastName}
                    </h1>
                    <p className="mt-1 text-sm text-[#718075]">
                      {user.city?.name ?? "Город не указан"}
                    </p>
                    <p className="mt-3 text-sm text-[#607267]">
                      {user.about || "Расскажите немного о себе."}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditing(!editing)}
                    className="rounded-xl border border-[#cfdacd] px-4 py-2.5 text-sm font-bold"
                  >
                    {editing ? "Закрыть" : "Редактировать"}
                  </button>
                </div>
                {editing ? (
                  <ProfileEditor
                    user={user}
                    cities={cities}
                    interests={interests}
                    onUpdate={(next) => {
                      onUpdate(next)
                      setEditing(false)
                    }}
                  />
                ) : (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {user.interests.map((item) => (
                      <span
                        key={item.id}
                        className="rounded-full bg-[#eff9db] px-3 py-1 text-xs font-bold"
                      >
                        {item.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={onFindEvents}
                className="mt-6 rounded-xl bg-[#102318] px-5 py-3 text-sm font-extrabold text-[#bdf238]"
              >
                Найти новое событие
              </button>
            </>
          ) : null}
          {tab === "events" ? (
            <section>
              <h2 className="text-2xl font-black">Мои события</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => onOpenEvent(event)}
                    className="overflow-hidden rounded-2xl border border-[#dce5da] bg-white text-left"
                  >
                    <img
                      src={event.imageUrl ?? ""}
                      alt=""
                      className="h-32 w-full object-cover"
                    />
                    <div className="p-4">
                      <div className="flex justify-between gap-2">
                        <b>{event.title}</b>
                        <span className="rounded-full bg-[#eff9db] px-2 py-1 text-[10px] font-bold">
                          {eventLabels[event.status]}
                        </span>
                      </div>
                      {event.moderationReason ? (
                        <p className="mt-2 text-xs text-[#9e3128]">
                          Причина: {event.moderationReason}
                        </p>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          {tab === "companies" ? (
            <section>
              <h2 className="text-2xl font-black">Мои компании</h2>
              <div className="mt-5 space-y-3">
                {companies.map((company) => (
                  <CompanyCard
                    key={company.id}
                    company={company}
                    user={user}
                    onChanged={load}
                    onOpenChats={onOpenChats}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {tab === "applications" ? (
            <section>
              <h2 className="text-2xl font-black">Заявки</h2>
              <div className="mt-5 space-y-3">
                {applications.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce5da] bg-white p-5"
                  >
                    <div>
                      <b>Компания #{item.companyId}</b>
                      <p className="mt-1 text-sm text-[#718075]">
                        {appLabels[item.status]}
                      </p>
                    </div>
                    {item.status === "pending" ? (
                      <button
                        onClick={async () => {
                          try {
                            await api.cancelMyCompanyApplication(item.companyId)
                            await load()
                          } catch (caught) {
                            setError(
                              caught instanceof Error
                                ? caught.message
                                : "Не удалось отменить заявку",
                            )
                          }
                        }}
                        className="rounded-xl border border-[#e4b9b2] px-3 py-2 text-xs font-bold text-[#9e3128]"
                      >
                        Отменить заявку
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  )
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
    <article className="rounded-2xl border border-[#dce5da] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-extrabold">{company.name}</h3>
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                company.status === "active"
                  ? "bg-[#eff9db] text-[#31513a]"
                  : "bg-[#fff5dc] text-[#7d6022]"
              }`}
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
          className="grid h-10 w-10 place-items-center rounded-xl bg-[#102318] text-[#bdf238]"
        >
          <ForumOutlined fontSize="small" />
        </button>
      </div>
      <div className="mt-4 border-t border-[#edf1ea] pt-4">
        {owner ? (
          <button
            onClick={() => setManage(!manage)}
            className="rounded-xl bg-[#102318] px-3 py-2 text-xs font-bold text-[#bdf238]"
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
            className="rounded-xl border border-[#e4b9b2] px-3 py-2 text-xs font-bold text-[#9e3128]"
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
    <div className="mt-5 rounded-2xl bg-[#f7faf5] p-4">
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
        <button className="rounded-xl bg-[#102318] px-4 py-2.5 text-xs font-bold text-[#bdf238]">
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
          className="rounded-xl border px-3 py-2 text-xs font-bold"
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
          className="rounded-xl border border-[#e4b9b2] px-3 py-2 text-xs font-bold text-[#9e3128]"
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
              className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span>
                {item.user.firstName} {item.user.lastName ?? ""}
                {item.message ? ` — ${item.message}` : ""}
              </span>
              <span className="flex gap-2">
                <button
                  onClick={() => void decide(item.id, "approve")}
                  className="rounded-lg bg-[#102318] px-2 py-1 text-xs text-[#bdf238]"
                >
                  Принять
                </button>
                <button
                  onClick={() => void decide(item.id, "reject")}
                  className="rounded-lg border px-2 py-1 text-xs"
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
      className="mt-7 grid gap-4 border-t border-[#edf1ea] pt-6 sm:grid-cols-2"
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
      <button className="sm:col-span-2 rounded-xl bg-[#102318] py-3 text-sm font-bold text-[#bdf238]">
        Сохранить профиль
      </button>
    </form>
  )
}
