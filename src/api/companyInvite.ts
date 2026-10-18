import type { Company, Event } from "./types"

export function inviteCompanyId(hash: string): number {
  const match = /^#\/?invite\/([1-9]\d*)$/.exec(hash)
  const id = match ? Number(match[1]) : 0
  return Number.isSafeInteger(id) ? id : 0
}

export function companyInviteUrl(
  companyId: number,
  origin: string,
  pathname = "/",
) {
  if (!Number.isSafeInteger(companyId) || companyId <= 0)
    throw new Error("Неверная компания")
  const url = new URL(pathname, origin)
  if (!/^https?:$/.test(url.protocol)) throw new Error("Неверный адрес сайта")
  url.search = ""
  url.hash = `invite/${companyId}`
  return url.toString()
}

export function companyInviteAvailable(
  company: Company,
  event: Event,
  now = Date.now(),
) {
  return (
    company.eventId === event.id &&
    company.status !== "blocked" &&
    event.status === "active" &&
    Number.isFinite(Date.parse(event.endsAt || event.startsAt)) &&
    Date.parse(event.endsAt || event.startsAt) > now
  )
}
