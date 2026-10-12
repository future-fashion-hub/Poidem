import type { Paginated, PageOptions } from "./types";
import { backendMode } from "./backendApi";

// Views without page controls still request every server page, not just the first 100.
export async function collectPages<T>(load: (options: PageOptions) => Promise<Paginated<T>>, limit = 100, paginateMock = false): Promise<Paginated<T>> {
  const first = await load({ page: 1, limit });
  if (!backendMode && !paginateMock) return first;
  const items = [...first.items];
  for (let current = 2; current <= first.pagination.totalPages; current++) {
    const next = await load({ page: current, limit });
    items.push(...next.items);
  }
  return { items, pagination: first.pagination };
}
