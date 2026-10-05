import type { DictionaryItem } from "./types";

export type Coordinates = { latitude: number; longitude: number };

const cityCenters: Record<string, Coordinates> = {
  "москва": { latitude: 55.7558, longitude: 37.6173 },
  "санкт-петербург": { latitude: 59.9343, longitude: 30.3351 },
  "новосибирск": { latitude: 55.0084, longitude: 82.9357 },
  "екатеринбург": { latitude: 56.8389, longitude: 60.6057 },
  "казань": { latitude: 55.7961, longitude: 49.1064 },
  "нижний новгород": { latitude: 56.2965, longitude: 43.9361 },
  "красноярск": { latitude: 56.0153, longitude: 92.8932 },
  "челябинск": { latitude: 55.1644, longitude: 61.4368 },
  "самара": { latitude: 53.1959, longitude: 50.1002 },
  "уфа": { latitude: 54.7388, longitude: 55.9721 },
  "ростов-на-дону": { latitude: 47.2357, longitude: 39.7015 },
  "краснодар": { latitude: 45.0355, longitude: 38.9753 },
  "омск": { latitude: 54.9885, longitude: 73.3242 },
  "воронеж": { latitude: 51.6608, longitude: 39.2003 },
  "пермь": { latitude: 58.0105, longitude: 56.2502 },
  "волгоград": { latitude: 48.708, longitude: 44.5133 },
  "саратов": { latitude: 51.5336, longitude: 46.0343 },
  "тюмень": { latitude: 57.153, longitude: 65.5343 },
  "тольятти": { latitude: 53.5088, longitude: 49.4192 },
  "ижевск": { latitude: 56.8527, longitude: 53.2115 },
};

export function cityCenter(city: DictionaryItem | undefined): Coordinates | null {
  return city ? cityCenters[city.name.trim().toLocaleLowerCase("ru-RU")] ?? null : null;
}

function distanceKm(a: Coordinates, b: Coordinates): number {
  const latitude = (b.latitude - a.latitude) * Math.PI / 180;
  const longitude = (b.longitude - a.longitude) * Math.PI / 180;
  const radius = Math.PI / 180;
  const arc = Math.sin(latitude / 2) ** 2 + Math.cos(a.latitude * radius) * Math.cos(b.latitude * radius) * Math.sin(longitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

export function cityForPoint(point: Coordinates, cities: DictionaryItem[]): DictionaryItem | null {
  const nearest = cities.map((city) => ({ city, center: cityCenter(city) }))
    .filter((item): item is { city: DictionaryItem; center: Coordinates } => item.center !== null)
    .map((item) => ({ city: item.city, distance: distanceKm(point, item.center) }))
    .sort((a, b) => a.distance - b.distance)[0];
  return nearest && nearest.distance <= 100 ? nearest.city : null;
}
