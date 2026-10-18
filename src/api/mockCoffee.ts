import type { CoffeeRecord, CoffeeTopic } from "./coffeeTypes";
import type { Company, Event, UserShort } from "./types";

export function createCoffeeSeeds(people: UserShort[], now = Date.now()) {
  const venues: [string, string, number, string, CoffeeTopic, "open" | "request", number, string][] = [
    ["Начнём с капучино", "Знакомимся за любимым напитком. Поговорим о городе, книгах и маленьких планах на большие выходные.", 1, "Кофейня у Чистых прудов", "chat", "open", 4, "1447933601403-0c6688de566e"],
    ["Есть идея? Давай обсудим", "Соберём маленький круг тех, кто делает своё дело. Можно принести проект, вопрос или просто любопытство.", 2, "Кофейня на Петроградской", "work", "request", 6, "1517245386807-bb43f82c33c4"],
    ["Кофе с собой и озеро Кабан", "Берём напитки и идём гулять вдоль воды. Спокойный темп, разговоры обо всём и никаких обязательных тем.", 3, "Вход на набережную Кабана", "walk", "open", 4, "1518837695005-2083093ee35b"],
    ["Полчаса без рабочих чатов", "Небольшая пауза посреди дня: знакомимся, выбираем десерт и делимся чем-то хорошим, что случилось за неделю.", 4, "Кофейня у Плотинки", "chat", "open", 3, "1509042239860-f550ce710b93"],
    ["Прогуляемся после фильтра", "Встретимся в центре Москвы, возьмём кофе и свернём в тихие переулки. Можно прийти одному — здесь все знакомятся с нуля.", 1, "Кофейня у Покровки", "walk", "request", 4, "1442512595331-e89e73853f31"],
    ["Завтрак для творческих", "Дизайн, музыка, тексты или своё маленькое дело — рассказываем, чем горим, и помогаем друг другу свежим взглядом.", 6, "Кофейня на Красном проспекте", "work", "open", 5, "1554118811-1e0d58224f24"],
  ];
  const events: Event[] = [], companies: Company[] = [], records: CoffeeRecord[] = [];
  venues.forEach(([title, description, cityId, locationName, topic, joinType, maxMembers, photo], index) => {
    const id = 3001 + index, creator = people[1 + index % (people.length - 1)];
    const start = new Date(now + (index + 1) * 86400000); start.setHours(18, 30, 0, 0);
    const createdAt = new Date(now).toISOString();
    events.push({ id, title, description, cityId, categoryId: 5, startsAt: start.toISOString(), endsAt: new Date(+start + 3600000).toISOString(), locationName, address: null, location: null, imageUrl: `https://images.unsplash.com/photo-${photo}?w=1000&h=700&fit=crop&auto=format`, status: "active", moderationReason: null, participantsCount: 1, companiesCount: 1, creator, createdAt, updatedAt: createdAt });
    companies.push({ id, eventId: id, name: title, description, maxMembers, membersCount: 1, joinType, owner: creator, rules: "Напитки каждый оплачивает самостоятельно. Если планы изменились, предупредите компанию.", minAge: null, maxAge: null, status: "active", createdAt, updatedAt: createdAt });
    records.push({ id, eventId: id, companyId: id, topic });
  });
  return { events, companies, records };
}
