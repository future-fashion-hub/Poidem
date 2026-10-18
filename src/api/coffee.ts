import type { CoffeeInput, CoffeeMeeting, CoffeeTopic } from "./coffeeTypes";

export const coffeeTopics: { value: CoffeeTopic; label: string; description: string }[] = [
  { value: "chat", label: "Познакомиться", description: "Разговоры без повестки" },
  { value: "work", label: "Обсудить идеи", description: "Проекты и единомышленники" },
  { value: "walk", label: "Кофе с собой", description: "Взять напиток и прогуляться" },
];
export const coffeeCover = "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=1000&h=700&fit=crop&auto=format";

export function validateCoffee(input: CoffeeInput, cities: number[], now = Date.now()) {
  const errors: Partial<Record<keyof CoffeeInput, string>> = {};
  if (input.title.trim().length < 3 || input.title.trim().length > 90) errors.title = "Название: от 3 до 90 символов.";
  if (input.description.trim().length < 10 || input.description.trim().length > 1200) errors.description = "Расскажите о встрече: от 10 до 1200 символов.";
  if (!cities.includes(input.cityId)) errors.cityId = "Выберите город.";
  if (input.locationName.trim().length < 3 || input.locationName.trim().length > 160) errors.locationName = "Укажите название кофейни или места встречи: от 3 до 160 символов.";
  if (input.address.trim().length > 240) errors.address = "Адрес не должен быть длиннее 240 символов.";
  if (!Number.isFinite(Date.parse(input.startsAt)) || Date.parse(input.startsAt) <= now) errors.startsAt = "Выберите дату и время в будущем.";
  if (![30, 60, 90, 120].includes(input.duration)) errors.duration = "Выберите длительность встречи.";
  if (!Number.isInteger(input.maxMembers) || input.maxMembers < 2 || input.maxMembers > 8) errors.maxMembers = "От 2 до 8 человек, включая вас.";
  if (!["open", "request"].includes(input.joinType)) errors.joinType = "Выберите способ вступления.";
  if (!coffeeTopics.some(topic => topic.value === input.topic)) errors.topic = "Выберите настроение встречи.";
  return errors;
}

export function coffeeAvailable(meeting: CoffeeMeeting, now = Date.now()) {
  return meeting.event.status === "active" && meeting.company.status !== "blocked"
    && Date.parse(meeting.event.endsAt ?? meeting.event.startsAt) > now;
}

export function filterCoffee(meetings: CoffeeMeeting[], when: string, onlySpots: boolean, now = Date.now()) {
  const today = new Date(now).toDateString();
  return meetings.filter(meeting => {
    if (!coffeeAvailable(meeting, now) && !(when === "mine" && meeting.participation === "owner" && meeting.event.status === "pending")) return false;
    if (when === "mine" && meeting.participation === "none") return false;
    const starts = Date.parse(meeting.event.startsAt);
    if (when === "today" && new Date(starts).toDateString() !== today) return false;
    if (when === "week" && starts > now + 7 * 86400000) return false;
    return !onlySpots || (meeting.company.status === "active" && meeting.company.membersCount < meeting.company.maxMembers);
  }).sort((a, b) => Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt));
}

export function coffeeDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
