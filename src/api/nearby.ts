import type { Event, EventFilters } from "./types";
import { eventPosition } from "./eventPosition";

export type Coordinates = { latitude: number; longitude: number };
export type NearbyEvent = { event: Event; distance: number };
const earthRadiusKm = 6371;
const radians = (value: number) => value * Math.PI / 180;
const degrees = (value: number) => value * 180 / Math.PI;
const wrapLongitude = (value: number) => ((value + 540) % 360) - 180;

export function distanceKm(from: Coordinates, to: Coordinates) {
  const lat = radians(to.latitude - from.latitude);
  const lon = radians(to.longitude - from.longitude);
  const a = Math.sin(lat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(lon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function nearbyBounds(point: Coordinates, radiusKm: number): EventFilters {
  const angle = radiusKm / earthRadiusKm;
  const lat = radians(point.latitude);
  const south = Math.max(-90, degrees(lat - angle));
  const north = Math.min(90, degrees(lat + angle));
  if (south === -90 || north === 90) return { west: -180, east: 180, south, north };
  const longitudeDelta = degrees(Math.asin(Math.min(1, Math.sin(angle) / Math.cos(lat))));
  return { west: wrapLongitude(point.longitude - longitudeDelta), east: wrapLongitude(point.longitude + longitudeDelta), south, north };
}

export function nearbyEvents(events: Event[], point: Coordinates, radiusKm: number, now = Date.now()): NearbyEvent[] {
  return events.flatMap(event => {
    const position = eventPosition(event);
    const endsAt = Date.parse(event.endsAt ?? event.startsAt);
    if (!position || event.status !== "active" || !Number.isFinite(endsAt) || endsAt <= now) return [];
    const distance = distanceKm(point, { latitude: position[0], longitude: position[1] });
    return distance <= radiusKm ? [{ event, distance }] : [];
  }).sort((a, b) => a.distance - b.distance || a.event.startsAt.localeCompare(b.event.startsAt));
}

export const distanceLabel = (km: number) => km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)} м` : `${km.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} км`;

// Three distinct impulses distinguish a deliberate shake from normal handling.
export function createShakeDetector() {
  let previous: { x: number; y: number; z: number; time: number } | null = null;
  let impulses: number[] = [];
  let lastImpulse = -Infinity;
  let lastTrigger = -Infinity;
  return (sample: { x: number | null; y: number | null; z: number | null }, time: number) => {
    const { x, y, z } = sample;
    if (x === null || y === null || z === null || ![x, y, z, time].every(Number.isFinite)) return false;
    const baseline = previous;
    previous = { x, y, z, time };
    if (!baseline || time - baseline.time > 1000 || time < baseline.time) { impulses = []; return false; }
    if (time - lastTrigger < 4000) return false;
    const change = Math.hypot(x - baseline.x, y - baseline.y, z - baseline.z);
    impulses = impulses.filter(value => time - value < 900);
    if (change < 12 || time - lastImpulse < 80) return false;
    lastImpulse = time;
    impulses.push(time);
    if (impulses.length < 3) return false;
    impulses = []; lastTrigger = time;
    return true;
  };
}
