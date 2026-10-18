import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import GroupsOutlined from "@mui/icons-material/GroupsOutlined"
import PlaceOutlined from "@mui/icons-material/PlaceOutlined"
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined"
import CheckRounded from "@mui/icons-material/CheckRounded"
import ForumOutlined from "@mui/icons-material/ForumOutlined"
import { api } from "../api"
import { collectPages } from "../api/pagination"
import {
  ApiError,
  type Company,
  type DictionaryItem,
  type Event,
  type User,
} from "../api/types"
import { companyInviteAvailable } from "../api/companyInvite"
import { useEventClock } from "./useEventClock"
import CompanyInviteLink from "./CompanyInviteLink"
import "./companyInvite.css"

type Props = {
  companyId: number
  token?: string
  user: User | null
  authLoading: boolean
  cities: DictionaryItem[]
  onAuth: () => void
  onChat: (id: number) => void
  onChanged: () => void
}
type Details = {
  company: Company
  event: Event
  member: boolean
  pending: boolean
}
export default function CompanyInvitePage({
  companyId,
  token = "",
  user,
  authLoading,
  cities,
  onAuth,
  onChat,
  onChanged,
}: Props) {
  const [details, setDetails] = useState<Details | null>(null),
    [loading, setLoading] = useState(true)
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false)
  const generation = useRef(0),
    mutating = useRef(false),
    alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      generation.current++
    }
  }, [])
  const events = useMemo(
    () => (details ? { [details.event.id]: details.event } : {}),
    [details?.event],
  )
  const now = useEventClock(events)
  const load = useCallback(async () => {
    const request = ++generation.current
    setLoading(true)
    setError("")
    setDetails(null)
    setNotice("")
    try {
      if (token) {
        const preview = await api.previewCompanyInvitation(token)
        if (request === generation.current && alive.current) setDetails(preview)
        return
      }
      if (!companyId) throw new Error("Некорректная ссылка приглашения.")
      const company = await api.getCompany(companyId)
      const [event, mine, application] = await Promise.all([
        api.getEvent(company.eventId),
        user
          ? collectPages((options) => api.listMyCompanies(options))
          : Promise.resolve({ items: [] as Company[] }),
        user && company.joinType === "request" && company.owner.id !== user.id
          ? api.getMyCompanyApplication(company.id).catch((error) => {
              if (error instanceof ApiError && error.status === 404) return null
              throw error
            })
          : Promise.resolve(null),
      ])
      if (!companyInviteAvailable(company, event))
        throw new Error(
          "Эта компания больше недоступна: встреча завершилась или была закрыта.",
        )
      if (request === generation.current && alive.current)
        setDetails({
          company: { ...company },
          event,
          member:
            company.owner.id === user?.id ||
            mine.items.some((item) => item.id === company.id),
          pending: application?.status === "pending",
        })
    } catch (caught) {
      if (request === generation.current && alive.current)
        setError(
          !token &&
            caught instanceof ApiError &&
            [403, 404, 410].includes(caught.status)
            ? "Приглашение недоступно. Возможно, компания удалена или доступ к ней ограничен."
            : caught instanceof Error
              ? caught.message
              : "Не удалось загрузить приглашение.",
        )
    } finally {
      if (request === generation.current && alive.current) setLoading(false)
    }
  }, [companyId, token, user?.id])
  useEffect(() => {
    if (!authLoading) void load()
    return () => {
      generation.current++
    }
  }, [load, authLoading])
  const act = async () => {
    if (!details || details.member || details.pending || mutating.current)
      return
    if (!user) {
      onAuth()
      return
    }
    if (
      !companyInviteAvailable(details.company, details.event) ||
      details.company.status !== "active" ||
      details.company.membersCount >= details.company.maxMembers
    )
      return
    mutating.current = true
    setBusy(true)
    setError("")
    setNotice("")
    const request = generation.current
    try {
      if (token) {
        const preview = await api.redeemCompanyInvitation(token)
        if (alive.current && request === generation.current) {
          setDetails(preview)
          setNotice(
            preview.pending
              ? "Заявка отправлена организатору. Чат откроется после одобрения."
              : "Вы в компании! Пора познакомиться в чате.",
          )
          onChanged()
        }
        return
      }
      if (details.company.joinType === "request")
        await api.createCompanyApplication(
          details.company.id,
          "Хочу присоединиться по приглашению.",
        )
      else await api.joinOpenCompany(details.company.id)
      if (!alive.current || request !== generation.current) return
      const pending = details.company.joinType === "request"
      setDetails(
        (previous) =>
          previous && {
            ...previous,
            member: !pending,
            pending,
            company: {
              ...previous.company,
              membersCount: previous.company.membersCount + (pending ? 0 : 1),
            },
          },
      )
      setNotice(
        pending
          ? "Заявка отправлена организатору. Чат откроется после одобрения."
          : "Вы в компании! Пора познакомиться в чате.",
      )
      onChanged()
    } catch (caught) {
      if (alive.current && request === generation.current)
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось присоединиться. Попробуйте ещё раз.",
        )
    } finally {
      mutating.current = false
      if (alive.current) setBusy(false)
    }
  }
  const available =
    details && companyInviteAvailable(details.company, details.event, now)
  const full =
    details && details.company.membersCount >= details.company.maxMembers
  return (
    <main className="company-invite-page">
      <p className="company-invite-eyebrow">Хорошие планы лучше вместе</p>
      <h1>
        Вас зовут в компанию<span>.</span>
      </h1>
      {loading || authLoading ? (
        <div className="company-invite-empty" role="status">
          Загружаем приглашение…
        </div>
      ) : !details ? (
        <section className="company-invite-empty">
          <GroupsOutlined aria-hidden="true" />
          <h2>Не удалось открыть приглашение</h2>
          <p role="alert">{error}</p>
          <button
            type="button"
            className="plans-button plans-button--secondary"
            onClick={() => {
              void load()
            }}
          >
            Попробовать снова
          </button>
          <a href="#map">Найти другую компанию на карте</a>
        </section>
      ) : (
        <article className="company-invite-card">
          {details.event.imageUrl && (
            <img
              className="company-invite-cover"
              src={details.event.imageUrl}
              alt=""
            />
          )}
          <div className="company-invite-body">
            <span className="company-invite-badge">
              <GroupsOutlined aria-hidden="true" />
              {details.member
                ? "Вы уже в компании"
                : details.company.joinType === "request"
                  ? "По заявке организатору"
                  : "Свободное вступление"}
            </span>
            <h2>{details.company.name}</h2>
            <p className="company-invite-event">{details.event.title}</p>
            <div className="company-invite-facts">
              <p>
                <ScheduleOutlined aria-hidden="true" />
                {new Date(details.event.startsAt).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p>
                <PlaceOutlined aria-hidden="true" />
                {cities.find((city) => city.id === details.event.cityId)
                  ?.name ?? "Город события"}{" "}
                · {details.event.locationName}
              </p>
              <p>
                <GroupsOutlined aria-hidden="true" />
                {details.company.membersCount} из {details.company.maxMembers}{" "}
                участников · Организатор: {details.company.owner.firstName}
              </p>
            </div>
            {details.company.description && (
              <p className="company-invite-description">
                {details.company.description}
              </p>
            )}
            {details.company.rules && (
              <aside className="company-invite-rules">
                <h3>Правила компании</h3>
                <p>{details.company.rules}</p>
              </aside>
            )}
            {(details.company.minAge != null ||
              details.company.maxAge != null) && (
              <p className="company-invite-hint">
                Возраст участников:{" "}
                {details.company.minAge != null
                  ? `от ${details.company.minAge}`
                  : ""}{" "}
                {details.company.maxAge != null
                  ? `до ${details.company.maxAge}`
                  : ""}{" "}
                лет.
              </p>
            )}
            {notice && (
              <p className="company-invite-notice" role="status">
                {notice}
              </p>
            )}
            {error && (
              <div>
                <p className="company-invite-error" role="alert">
                  {error}
                </p>
                <button
                  type="button"
                  className="plans-button plans-button--secondary"
                  disabled={busy}
                  onClick={() => {
                    void load()
                  }}
                >
                  Обновить сведения
                </button>
              </div>
            )}
            <div className="company-invite-join">
              {details.member ? (
                <button
                  type="button"
                  className="plans-button plans-button--primary"
                  disabled={!available}
                  onClick={() => onChat(details.company.id)}
                >
                  <ForumOutlined aria-hidden="true" />
                  Открыть чат компании
                </button>
              ) : details.pending ? (
                <p className="company-invite-notice">
                  <CheckRounded aria-hidden="true" />
                  Заявка уже отправлена
                </p>
              ) : (
                <button
                  type="button"
                  className="plans-button plans-button--primary"
                  disabled={
                    busy ||
                    !available ||
                    details.company.status !== "active" ||
                    Boolean(full)
                  }
                  aria-busy={busy}
                  onClick={() => {
                    void act()
                  }}
                >
                  {busy
                    ? "Сохраняем…"
                    : !available
                      ? "Встреча завершена"
                      : details.company.status !== "active"
                        ? "Набор закрыт"
                        : full
                          ? "Все места заняты"
                          : !user
                            ? "Войти и присоединиться"
                            : details.company.joinType === "request"
                              ? "Отправить заявку"
                              : "Присоединиться к компании"}
                </button>
              )}
              <p className="company-invite-hint">
                Ссылка не отменяет правила вступления. Чат доступен только
                участникам.
              </p>
            </div>
            <CompanyInviteLink
              company={details.company}
              canManage={details.company.owner.id === user?.id}
            />
          </div>
        </article>
      )}
    </main>
  )
}
