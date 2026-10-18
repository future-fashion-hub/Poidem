import type { Application, Company, Event } from "./types"
import type { SiteNotification } from "./notificationTypes"

type Source = {
  userId: number
  companies: Company[]
  events: Event[]
  applications: Application[]
  companyIds: number[]
  soloIds: number[]
}
export function deriveNotifications(
  source: Source,
  now = Date.now(),
): SiteNotification[] {
  const { userId, companies, events, applications, companyIds, soloIds } =
    source
  const result: SiteNotification[] = []
  const add = (item: Omit<SiteNotification, "readAt">) => {
    const time = Date.parse(item.createdAt)
    if (Number.isFinite(time) && time <= now && time >= now - 30 * 86400000)
      result.push({ ...item, readAt: null })
  }
  const accessible = new Set(
    companies
      .filter(
        (company) =>
          company.status !== "blocked" &&
          (company.owner.id === userId || companyIds.includes(company.id)),
      )
      .map((company) => company.id),
  )
  for (const application of applications) {
    const company = companies.find((item) => item.id === application.companyId)
    const at = application.resolvedAt || application.createdAt
    if (
      application.user.id === userId &&
      ["approved", "rejected", "cancelled"].includes(application.status)
    ) {
      const approved = application.status === "approved"
      add({
        id: `application:${application.companyId}:${application.user.id}:${application.id}:${application.status}:${at}`,
        kind: "application",
        title: approved
          ? "Вы в компании"
          : application.status === "rejected"
            ? "Заявка отклонена"
            : "Заявка отменена",
        body: approved
          ? `Вы присоединились к «${company?.name ?? "компании"}». Обсудите планы в чате.`
          : `Ваша заявка в «${company?.name ?? "компанию"}» больше не ожидает одобрения.`,
        createdAt: at,
        target:
          approved &&
          company &&
          company.status !== "blocked" &&
          accessible.has(company.id)
            ? { kind: "chat", id: company.id }
            : { kind: "plans", tab: "applications" },
      })
    }
    if (
      company?.owner.id === userId &&
      application.user.id !== userId &&
      ["pending", "approved"].includes(application.status)
    ) {
      add({
        id: `incoming:${application.companyId}:${application.user.id}:${application.id}:${application.status}:${at}`,
        kind: "application",
        title:
          application.status === "pending"
            ? "Новая заявка в компанию"
            : "В компании новый участник",
        body: `${application.user.firstName} · «${company.name}»`,
        createdAt: at,
        target: { kind: "company", id: company.id },
      })
    }
  }
  for (const company of companies) {
    if (!accessible.has(company.id)) continue
    if (company.owner.id === userId)
      add({
        id: `company:${company.id}:created`,
        kind: "company",
        title: "Компания создана",
        body: `«${company.name}» ждёт участников. Пригласите друзей или проверьте заявки.`,
        createdAt: company.createdAt,
        target: { kind: "company", id: company.id },
      })
  }
  const relatedEvents = new Set([
    ...soloIds,
    ...companies
      .filter((company) => accessible.has(company.id))
      .map((company) => company.eventId),
  ])
  for (const event of events) {
    if (!relatedEvents.has(event.id) && event.creator.id !== userId) continue
    if (event.updatedAt !== event.createdAt)
      add({
        id: `event:${event.id}:${event.status}:${event.updatedAt}`,
        kind: "event",
        title:
          event.status === "active"
            ? "Информация о событии обновлена"
            : event.status === "completed"
              ? "Событие завершено"
              : "Статус события изменился",
        body: `«${event.title}» — проверьте актуальные детали.`,
        createdAt: event.updatedAt,
        target:
          event.status === "active"
            ? { kind: "event", id: event.id }
            : { kind: "plans", tab: "events" },
      })
    const remaining = Date.parse(event.startsAt) - now
    if (
      event.status !== "active" ||
      remaining <= 0 ||
      remaining > 86400000 ||
      !relatedEvents.has(event.id)
    )
      continue
    const windowHours = remaining <= 3600000 ? 1 : 24
    add({
      id: `reminder:${event.id}:${event.startsAt}:${windowHours}`,
      kind: "reminder",
      title:
        windowHours === 1 ? "Встреча уже скоро" : "План на ближайшие сутки",
      body: `«${event.title}» · ${event.locationName}`,
      createdAt: new Date(
        Date.parse(event.startsAt) - windowHours * 3600000,
      ).toISOString(),
      target: { kind: "event", id: event.id },
    })
  }
  return result.sort(
    (a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
      a.id.localeCompare(b.id),
  )
}

export function mergeNotifications(
  existing: SiteNotification[],
  incoming: SiteNotification[],
  now = Date.now(),
) {
  const merged = new Map(existing.map((item) => [item.id, item]))
  for (const item of incoming)
    if (!merged.has(item.id)) merged.set(item.id, item)
  return [...merged.values()]
    .filter((item) => Date.parse(item.createdAt) >= now - 30 * 86400000)
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 200)
}
