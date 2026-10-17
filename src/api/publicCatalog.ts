import type { DictionaryItem, Event } from "./types";

// Quarantine explicitly technical fixtures, not ordinary user-created events.
export function technicalFixture(name: string, slug: string | null = null) {
  return /^(?:map[\s_-]+test[\s_-]+(?:city|category)|(?:e2e|fixture|test)[\s_-]+(?:city|category|event))(?:\b|[\s_-])/i.test(`${name} `) || /^(?:e2e|fixture|map-test)(?:-|$)/i.test(slug ?? "");
}
export function publicDictionary(items: DictionaryItem[]) { return items.filter(item => !technicalFixture(item.name, item.slug)); }
export function publicEvents(items: Event[], hiddenCityIds: Set<number>, hiddenCategoryIds: Set<number>) {
  return items.filter(item => !technicalFixture(item.title) && !hiddenCityIds.has(item.cityId) && !hiddenCategoryIds.has(item.categoryId));
}
