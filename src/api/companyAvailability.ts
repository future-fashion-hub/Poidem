import type { Company, Event } from "./types";

export type CompanyEventIndex = Record<number, Event | null>;

export function companyEventAvailable(company: Company, events: CompanyEventIndex, now = Date.now()) {
  const event = events[company.eventId];
  if (!event || event.status === "completed") return false;
  const deadline = Date.parse(event.endsAt || event.startsAt);
  return Number.isFinite(deadline) && deadline > now;
}

export async function loadCompanyEvents(companies: Company[], known: Event[], loadEvent: (id: number) => Promise<Event>): Promise<CompanyEventIndex> {
  const result: CompanyEventIndex = Object.fromEntries(known.map(event => [event.id, event]));
  const missing = [...new Set(companies.map(company => company.eventId))].filter(id => !(id in result));
  // Share event metadata across companies and bound concurrent API requests.
  for (let start = 0; start < missing.length; start += 8) {
    await Promise.all(missing.slice(start, start + 8).map(async id => {
      try { result[id] = await loadEvent(id); }
      catch (error) {
        const status = (error as { status?: number })?.status;
        if (status === 403 || status === 404 || status === 410) result[id] = null;
        else throw error;
      }
    }));
  }
  return result;
}
