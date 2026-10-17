import type { Company, Event } from "./types";

export function soloEventIds(myEvents: Event[], myCompanies: Company[]) {
  const companyEvents = new Set(myCompanies.filter(company => company.status !== "blocked").map(company => company.eventId));
  return myEvents.filter(event =>
    (event.relation === "participant" || event.relation === "creator_and_participant") && !companyEvents.has(event.id)
  ).map(event => event.id);
}

export function mergeEvent(items: Event[], event: Event) {
  return items.map(item => item.id === event.id ? { ...item, ...event } : item);
}
