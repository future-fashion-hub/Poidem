import type { Event } from "./types";

function coordinate(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function eventPosition(event: Pick<Event, "location">): [number, number] | null {
  const latitude = coordinate(event.location?.latitude);
  const longitude = coordinate(event.location?.longitude);
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return [latitude, longitude];
}
