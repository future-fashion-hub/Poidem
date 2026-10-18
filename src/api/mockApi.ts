import type { CompanyInput, CompanyInvitation, CompanyInvitationOptions, CompanyInvitationPreview, Application, Company, CompanyMessage, CompanyUpdate, DictionaryItem, Event, EventFilters, EventInput, Favorite, PageOptions, Paginated, Report, User, UserShort } from "./types";
import { ApiError } from "./types";
import { createMockMapEvents, extraMapCities, relocateMockMapEvent, refreshMockMapEventContent } from "./mockMapEvents";
import type { CoffeeFilters, CoffeeInput, CoffeeMeeting, CoffeeRecord } from "./coffeeTypes";
import { createCoffeeSeeds } from "./mockCoffee";
import { coffeeCover, validateCoffee } from "./coffee";
import type { SiteNotification } from "./notificationTypes";
import { deriveNotifications, mergeNotifications } from "./demoNotifications";

const cities: DictionaryItem[] = [
  { id: 1, name: "Москва", slug: "moscow" }, { id: 2, name: "Санкт-Петербург", slug: "saint-petersburg" },
  { id: 3, name: "Казань", slug: "kazan" }, { id: 4, name: "Екатеринбург", slug: "ekaterinburg" },
  ...extraMapCities,
];
const categories: DictionaryItem[] = [
  { id: 1, name: "Технологии", slug: "technology" }, { id: 2, name: "Музыка", slug: "music" },
  { id: 3, name: "Искусство", slug: "art" }, { id: 4, name: "Спорт", slug: "sport" },
  { id: 5, name: "Еда", slug: "food" }, { id: 6, name: "Кино", slug: "cinema" },
  { id: 7, name: "Книги", slug: "books" }, { id: 8, name: "Театр", slug: "theater" },
  { id: 9, name: "Фотография", slug: "photography" }, { id: 10, name: "Настольные игры", slug: "board-games" },
  { id: 11, name: "Танцы", slug: "dance" }, { id: 12, name: "Психология", slug: "psychology" },
  { id: 13, name: "Волонтёрство", slug: "volunteering" }, { id: 14, name: "Языки", slug: "languages" },
  { id: 15, name: "Предпринимательство", slug: "business" }, { id: 16, name: "Наука", slug: "science" },
  { id: 17, name: "Прогулки", slug: "walks" }, { id: 18, name: "Йога и здоровье", slug: "wellbeing" },
];
const interests: DictionaryItem[] = [
  { id: 101, name: "Музыка", slug: "music" }, { id: 102, name: "Спорт", slug: "sport" },
  { id: 103, name: "Технологии", slug: "technology" }, { id: 104, name: "Искусство", slug: "art" },
  { id: 105, name: "Еда", slug: "food" }, { id: 106, name: "Путешествия", slug: "travel" },
  { id: 107, name: "Кино", slug: "cinema" }, { id: 108, name: "Игры", slug: "games" },
  { id: 109, name: "Книги", slug: "books" }, { id: 110, name: "Театр", slug: "theater" },
  { id: 111, name: "Фотография", slug: "photography" }, { id: 112, name: "Настольные игры", slug: "board-games" },
  { id: 113, name: "Танцы", slug: "dance" }, { id: 114, name: "Психология", slug: "psychology" },
  { id: 115, name: "Волонтёрство", slug: "volunteering" }, { id: 116, name: "Языки", slug: "languages" },
  { id: 117, name: "Предпринимательство", slug: "business" }, { id: 118, name: "Наука", slug: "science" },
  { id: 119, name: "Прогулки", slug: "walks" }, { id: 120, name: "Йога и здоровье", slug: "yoga-and-health" },
];
const people: UserShort[] = [
  { id: 1, firstName: "Алексей", lastName: "Морозов", avatarUrl: null },
  { id: 2, firstName: "Маша", lastName: "Орлова", avatarUrl: null },
  { id: 3, firstName: "Илья", lastName: "Ким", avatarUrl: null },
  { id: 4, firstName: "Лена", lastName: "Волкова", avatarUrl: null },
];
const makeEvent = (data: Partial<Event> & Pick<Event, "id" | "title" | "categoryId" | "cityId" | "startsAt" | "locationName">): Event => ({
  description: null, endsAt: null, address: null, location: null, imageUrl: null, status: "active", moderationReason: null, participantsCount: 0,
  companiesCount: 0, creator: people[1], createdAt: "2026-09-01T12:00:00+03:00", updatedAt: "2026-09-22T12:00:00+03:00", ...data,
});
const additionalMapEvents = createMockMapEvents(people[1]);
const initialEvents: Event[] = [
  makeEvent({ id: 1, title: "Moscow Tech Week 2026", description: "Большая неделя технологий, продуктов и новых знакомств. Лекции, воркшопы и вечерний нетворкинг.", categoryId: 1, cityId: 1, startsAt: "2026-10-18T19:00:00+03:00", endsAt: "2026-10-18T23:00:00+03:00", locationName: "Дизайн-завод", address: "Большая Новодмитровская, 36", location: { latitude: 55.8057, longitude: 37.5869, source: "manual" }, imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=700&fit=crop&auto=format", participantsCount: 146, companiesCount: 12 }),
  makeEvent({ id: 2, title: "Пикник «Стереолето»", description: "Музыка под открытым небом, фудкорт и два танцпола. Собираем лёгкую компанию без строгого плана.", categoryId: 2, cityId: 2, startsAt: "2026-10-24T15:00:00+03:00", endsAt: "2026-10-24T23:30:00+03:00", locationName: "Севкабель Порт", address: "Кожевенная линия, 40", location: { latitude: 59.9251, longitude: 30.2414, source: "manual" }, imageUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&h=700&fit=crop&auto=format", participantsCount: 89, companiesCount: 8, creator: people[2] }),
  makeEvent({ id: 3, title: "Ночь современного искусства", description: "Галереи, медиаинсталляции и ночная прогулка по центру Казани.", categoryId: 3, cityId: 3, startsAt: "2026-11-02T20:00:00+03:00", endsAt: "2026-11-03T02:00:00+03:00", locationName: "Смена", address: "Бурхана Шахиди, 7", location: { latitude: 55.7961, longitude: 49.1064, source: "manual" }, imageUrl: "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=1200&h=700&fit=crop&auto=format", participantsCount: 54, companiesCount: 5, creator: people[3] }),
  makeEvent({ id: 4, title: "Ночной забег по набережной", description: "Пять километров в комфортном темпе. Подходит новичкам — бежим вместе и никого не бросаем.", categoryId: 4, cityId: 1, startsAt: "2026-10-09T21:00:00+03:00", endsAt: "2026-10-09T23:00:00+03:00", locationName: "Лужники", address: "Лужнецкая набережная, 24", location: { latitude: 55.7158, longitude: 37.5534, source: "manual" }, imageUrl: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&h=700&fit=crop&auto=format", participantsCount: 42, companiesCount: 4 }),
  makeEvent({ id: 5, title: "Большой городской бранч", description: "Дегустации, локальные проекты и разговоры за общим столом.", categoryId: 5, cityId: 4, startsAt: "2026-11-08T12:00:00+03:00", endsAt: "2026-11-08T18:00:00+03:00", locationName: "Дом Печати", address: "проспект Ленина, 49", location: { latitude: 56.8371, longitude: 60.6145, source: "manual" }, imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&h=700&fit=crop&auto=format", participantsCount: 31, companiesCount: 3, creator: people[2] }),
  makeEvent({ id: 6, title: "Премьера и разговор с режиссёром", description: "Смотрим новую российскую драму, после — обсуждение с командой фильма.", categoryId: 6, cityId: 1, startsAt: "2026-11-16T19:30:00+03:00", endsAt: "2026-11-16T23:00:00+03:00", locationName: "Художественный", address: "Арбатская площадь, 14", location: { latitude: 55.7557, longitude: 37.6097, source: "manual" }, imageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&h=700&fit=crop&auto=format", participantsCount: 68, companiesCount: 7, creator: people[3] }),
  ...additionalMapEvents,
];
const company = (id: number, eventId: number, name: string, description: string, maxMembers: number, membersCount: number, joinType: "open" | "request", owner: UserShort): Company => ({ id, eventId, name, description, maxMembers, membersCount, joinType, owner, rules: null, minAge: null, maxAge: null, status: "active", createdAt: "2026-09-04T10:00:00+03:00", updatedAt: "2026-09-20T10:00:00+03:00" });
const initialCompanies = [
  company(1, 1, "Продуктовые и без пафоса", "Идём на основные доклады, потом знакомиться на афтепати.", 6, 4, "open", people[1]),
  company(2, 1, "Frontend-завтрак", "Встречаемся за час до открытия и пьём кофе рядом.", 5, 3, "request", people[2]),
  company(3, 2, "Танцуем до закрытия", "Хотим увидеть все хедлайнерские сеты.", 8, 5, "open", people[3]),
  company(4, 3, "Медленный маршрут", "Смотрим вдумчиво, обсуждаем и не торопимся.", 5, 2, "request", people[1]),
  company(5, 4, "Первые пять километров", "Темп 6:30–7:00, идеально для первого старта.", 6, 4, "open", people[2]),
];

type StoredInvitation = CompanyInvitation & { redeemedBy: number[] };
type State = { notificationsByUser: Record<string, SiteNotification[]>; companyInvitations: Record<string, StoredInvitation>; coffeeRecords: CoffeeRecord[]; coffeeSeedVersion: number; user: User | null; users: User[]; events: Event[]; companies: Company[]; applications: Application[]; reports: Report[]; joinedCompanyIds: number[]; soloEventIds: number[]; companyMemberships: Record<string, number[]>; soloEventMemberships: Record<string, number[]>; favoritesByUser: Record<string, { eventId: number; savedAt: string }[]> };
const storageKey = "poydem_mock_v1";
const demoUser: User = { ...people[0], city: cities[0], about: "Люблю технологии, живую музыку и спонтанные планы.", interests: [interests[0], interests[2], interests[6]], role: "user", status: "active", isProfileComplete: true, createdAt: "2026-06-14T12:00:00+03:00", gender: "male", birthDate: "1997-05-18" };
const adminUser: User = { id: 99, firstName: "Администратор", lastName: "Пойдём", avatarUrl: null, city: cities[0], about: "Системный администратор", interests: [], role: "admin", status: "active", isProfileComplete: true, createdAt: "2026-04-01T09:00:00+03:00", gender: null, birthDate: null };
const initialUsers: User[] = [
  demoUser,
  { ...people[1], city: cities[1], about: "Организую встречи и конференции", interests: [interests[2]], role: "user", status: "active", isProfileComplete: true, createdAt: "2026-08-04T12:00:00+03:00", gender: "female", birthDate: "1993-10-12" },
  { ...people[2], city: cities[2], about: null, interests: [interests[1]], role: "user", status: "active", isProfileComplete: true, createdAt: "2026-08-22T12:00:00+03:00", gender: "male", birthDate: "1999-03-08" },
  { ...people[3], city: cities[0], about: "Музыка и современное искусство", interests: [interests[0], interests[3]], role: "user", status: "active", isProfileComplete: true, createdAt: "2026-09-10T12:00:00+03:00", gender: "female", birthDate: "1995-07-22" },
  adminUser,
];
const initialReports: Report[] = [
  { id: 1, targetType: "event", targetId: 2, reason: "Некорректное описание", description: "В описании мероприятия есть спорная информация о площадке.", author: people[0], status: "pending", resolvedBy: null, createdAt: "2026-09-22T14:20:00+03:00", resolvedAt: null },
  { id: 2, targetType: "company", targetId: 4, reason: "Спам", description: "Организатор отправляет одинаковые сообщения участникам.", author: people[2], status: "pending", resolvedBy: null, createdAt: "2026-09-23T10:05:00+03:00", resolvedAt: null },
  { id: 3, targetType: "user", targetId: 3, reason: "Оскорбления", description: "Жалоба рассмотрена, нарушение не подтвердилось.", author: people[1], status: "rejected", resolvedBy: adminUser, createdAt: "2026-09-18T18:40:00+03:00", resolvedAt: "2026-09-19T09:15:00+03:00" },
];
const mapEventsSeedVersion = 3;
const initialCoffee = createCoffeeSeeds(people);
const fresh = (): State & { mapEventsSeedVersion: number } => ({ notificationsByUser: {}, companyInvitations: {}, mapEventsSeedVersion, coffeeSeedVersion: 1, coffeeRecords: [...initialCoffee.records], user: null, users: initialUsers, events: [...initialEvents, ...initialCoffee.events.map(event => ({ ...event }))], companies: [...initialCompanies, ...initialCoffee.companies.map(company => ({ ...company }))], applications: [], reports: initialReports, joinedCompanyIds: [], soloEventIds: [], companyMemberships: {}, soloEventMemberships: {}, favoritesByUser: {} });
function load(): State {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return fresh();
    const parsed = JSON.parse(saved) as Partial<State> & { mapEventsSeedVersion?: number };
    const events = (parsed.events ?? initialEvents).map(event => {
      if ((parsed.mapEventsSeedVersion ?? 0) < 2) event = relocateMockMapEvent(event);
      if ((parsed.mapEventsSeedVersion ?? 0) < 3) event = refreshMockMapEventContent(event);
      // Older demo snapshots predate location. Restore only known, unchanged
      // demo venues; keep explicit nulls and user-created events untouched.
      if (Object.prototype.hasOwnProperty.call(event, "location")) return event;
      const original = initialEvents.find(seed => seed.id === event.id
        && seed.cityId === event.cityId && seed.locationName === event.locationName
        && seed.address === event.address);
      return original ? { ...event, location: original.location } : event;
    });
    if ((parsed.mapEventsSeedVersion ?? 0) < 1) {
      const existingIds = new Set(events.map(event => event.id));
      events.push(...additionalMapEvents.filter(event => !existingIds.has(event.id)));
    }
    const companies = [...(parsed.companies ?? initialCompanies)];
    if (!parsed.coffeeSeedVersion) {
      const eventIds = new Set(events.map(event => event.id)), companyIds = new Set(companies.map(company => company.id));
      events.push(...initialCoffee.events.filter(event => !eventIds.has(event.id)));
      companies.push(...initialCoffee.companies.filter(company => !companyIds.has(company.id)));
    }
    const restored = { ...fresh(), ...parsed, mapEventsSeedVersion, coffeeSeedVersion: 1, events, companies, users: parsed.users ?? initialUsers, reports: parsed.reports ?? initialReports };
    if ((parsed.mapEventsSeedVersion ?? 0) < mapEventsSeedVersion || !parsed.coffeeSeedVersion) {
      try { localStorage.setItem(storageKey, JSON.stringify(restored)); } catch { /* Preserve loaded user data if storage is full. */ }
    }
    return restored;
  } catch { return fresh(); }
}
let state = load();
const passwordAccounts = new Map<string, { password: string; user: User }>();
const companyMessages = new Map<number, CompanyMessage[]>();
const persist = () => localStorage.setItem(storageKey, JSON.stringify(state));
const wait = () => new Promise((resolve) => setTimeout(resolve, 240));
const requireUser = () => { if (!state.user) throw new ApiError("UNAUTHORIZED", "Нужно войти в аккаунт", 401); return state.user; };
const companyIdsFor = (userId: number) => state.companyMemberships[String(userId)] ?? (state.companyMemberships[String(userId)] = []);
const eventIdsFor = (userId: number) => state.soloEventMemberships[String(userId)] ?? (state.soloEventMemberships[String(userId)] = []);
const ageOf = (birthDate?: string | null) => { if (!birthDate) return null; const today = new Date(); const born = new Date(birthDate); let age = today.getFullYear() - born.getFullYear(); if (today < new Date(today.getFullYear(), born.getMonth(), born.getDate())) age -= 1; return age; };
const page = <T,>(items: T[], current = 1, limit = 20): Paginated<T> => ({ items, pagination: { page: current, limit, total: items.length, totalPages: items.length ? Math.ceil(items.length / limit) : 0 } });

function coffeeMeeting(record: CoffeeRecord): CoffeeMeeting | null {
  const event = state.events.find(item => item.id === record.eventId), company = state.companies.find(item => item.id === record.companyId);
  if (!event || !company) return null;
  const userId = state.user?.id;
  const participation = userId === company.owner.id ? "owner" : userId && companyIdsFor(userId).includes(company.id) ? "member"
    : state.applications.some(item => item.companyId === company.id && item.user.id === userId && item.status === "pending") ? "pending" : "none";
  return { ...record, event: { ...event }, company: { ...company }, participation };
}

function ensureCoffeeRoomOpen(company: Company) {
  if (!state.coffeeRecords.some(record => record.companyId === company.id)) return;
  const event = state.events.find(item => item.id === company.eventId);
  if (!event || event.status !== "active" || Date.parse(event.endsAt ?? event.startsAt) <= Date.now()) throw new ApiError("EVENT_UNAVAILABLE", "Встреча уже завершилась или недоступна", 409);
  if (company.status !== "active") throw new ApiError("COMPANY_CLOSED", "Набор в компанию закрыт", 409);
  if (company.membersCount >= company.maxMembers) throw new ApiError("COMPANY_FULL", "В компании нет свободных мест", 409);
}

function companyReadable(company: Company) {
  return company.visibility !== "private" || state.user?.id === company.owner.id || Boolean(state.user && companyIdsFor(state.user.id).includes(company.id)) || state.user?.role === "admin";
}
function requireCompanyMember(companyId: number) {
  const user = requireUser(), company = state.companies.find(item => item.id === companyId);
  if (!company || company.status === "blocked" || (company.owner.id !== user.id && !companyIdsFor(user.id).includes(companyId))) throw new ApiError("FORBIDDEN", "Чат доступен только участникам компании", 403);
  return company;
}
function requireInviteOwner(companyId: number) {
  const user = requireUser(), company = state.companies.find(item => item.id === companyId);
  if (!company || company.owner.id !== user.id || company.visibility !== "private") throw new ApiError("FORBIDDEN", "Приглашениями управляет организатор закрытой компании", 403);
  return company;
}
function ensurePrivateCompanyOpen(company: Company) {
  if (company.visibility !== "private") return;
  const event = state.events.find(item => item.id === company.eventId);
  if (company.status !== "active" || !event || event.status !== "active" || Date.parse(event.endsAt || event.startsAt) <= Date.now()) throw new ApiError("COMPANY_CLOSED", "Компания или встреча больше не принимает участников", 409);
}
function readInvitation(token: string) {
  const invitation = state.companyInvitations[token], company = invitation && state.companies.find(item => item.id === invitation.companyId);
  const event = company && state.events.find(item => item.id === company.eventId);
  if (!invitation || invitation.revoked || Date.parse(invitation.expiresAt) <= Date.now() || !company || !event || company.status === "blocked" || event.status !== "active" || Date.parse(event.endsAt || event.startsAt) <= Date.now()) throw new ApiError("INVITATION_UNAVAILABLE", "Приглашение отозвано, истекло или встреча недоступна. Попросите организатора прислать новую ссылку.", 410);
  return { invitation, company, event };
}
function invitationPreview(token: string): CompanyInvitationPreview {
  const { invitation, company, event } = readInvitation(token), userId = state.user?.id;
  const member = company.owner.id === userId || Boolean(userId && companyIdsFor(userId).includes(company.id));
  const pending = state.applications.some(item => item.companyId === company.id && item.user.id === userId && item.status === "pending");
  if (!member && !pending && invitation.uses >= invitation.maxUses) throw new ApiError("INVITATION_EXHAUSTED", "Лимит приглашений по этой ссылке исчерпан", 410);
  return { company: { ...company }, event: { ...event }, member, pending };
}
function commitDemo(next: State) {
  try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { throw new ApiError("STORAGE_FULL", "Не удалось сохранить изменения. Освободите место в браузере.", 507); }
  state = next;
}
function syncDemoNotifications() {
  const user = requireUser(), key = String(user.id), previous = state.notificationsByUser[key] ?? [];
  const incoming = deriveNotifications({ userId: user.id, companies: state.companies, events: state.events, applications: state.applications, companyIds: companyIdsFor(user.id), soloIds: eventIdsFor(user.id) });
  const items = mergeNotifications(previous, incoming);
  if (JSON.stringify(previous) !== JSON.stringify(items)) commitDemo({ ...state, notificationsByUser: { ...state.notificationsByUser, [key]: items } });
  return { key, items };
}
export const mockApi = {
  async listNotifications(options: PageOptions = {}) {
    await wait(); const { items } = syncDemoNotifications();
    const current = Math.max(1, options.page ?? 1), limit = Math.max(1, options.limit ?? 30);
    return { ...page(items, current, limit), items: items.slice((current - 1) * limit, current * limit).map(item => ({ ...item })) };
  },
  async markNotificationsRead(ids: string[]) {
    await wait(); const { key, items } = syncDemoNotifications();
    if (!Array.isArray(ids) || ids.length > 200 || ids.some(id => !items.some(item => item.id === id))) throw new ApiError("NOTIFICATION_NOT_FOUND", "Уведомление недоступно для этого аккаунта", 404);
    const selected = new Set(ids);
    const readAt = new Date().toISOString();
    commitDemo({ ...state, notificationsByUser: { ...state.notificationsByUser, [key]: items.map(item => selected.has(item.id) && !item.readAt ? { ...item, readAt } : item) } });
  },
  async getCompanyInvitation(companyId: number): Promise<CompanyInvitation | null> {
    await wait(); requireInviteOwner(companyId);
    const invitation = Object.values(state.companyInvitations).find(item => item.companyId === companyId && !item.revoked);
    if (!invitation) return null;
    const { redeemedBy: _used, ...result } = invitation; return { ...result };
  },
  async createCompanyInvitation(companyId: number, input: CompanyInvitationOptions): Promise<CompanyInvitation> {
    await wait(); const company = requireInviteOwner(companyId), event = state.events.find(item => item.id === company.eventId);
    if (!event || event.status !== "active" || Date.parse(event.endsAt || event.startsAt) <= Date.now() || company.status !== "active") throw new ApiError("COMPANY_CLOSED", "Откройте набор в действующую компанию перед созданием приглашения", 409);
    if (![24, 168, 720].includes(input.expiresInHours) || !Number.isInteger(input.maxUses) || input.maxUses < 1 || input.maxUses > 100) throw new ApiError("VALIDATION_ERROR", "Срок: 1, 7 или 30 дней; лимит: от 1 до 100 использований", 400);
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const invitation: StoredInvitation = { token, companyId, expiresAt: new Date(Date.now() + input.expiresInHours * 3600000).toISOString(), maxUses: input.maxUses, uses: 0, revoked: false, redeemedBy: [] };
    const invitations = Object.fromEntries(Object.entries(state.companyInvitations).map(([key, value]) => [key, value.companyId === companyId ? { ...value, revoked: true } : value]));
    commitDemo({ ...state, companyInvitations: { ...invitations, [token]: invitation } });
    const { redeemedBy: _used, ...result } = invitation; return result;
  },
  async revokeCompanyInvitation(companyId: number) {
    await wait(); requireInviteOwner(companyId);
    commitDemo({ ...state, companyInvitations: Object.fromEntries(Object.entries(state.companyInvitations).map(([key, item]) => [key, item.companyId === companyId ? { ...item, revoked: true } : item])) });
  },
  async previewCompanyInvitation(token: string) { await wait(); return invitationPreview(token); },
  async redeemCompanyInvitation(token: string) {
    await wait(); const user = requireUser();
    if (!user.isProfileComplete) throw new ApiError("PROFILE_INCOMPLETE", "Сначала заполните профиль", 403);
    const preview = invitationPreview(token), { invitation, company, event } = readInvitation(token);
    if (preview.member || preview.pending) return preview;
    if (company.status !== "active" || company.membersCount >= company.maxMembers) throw new ApiError("COMPANY_FULL", "Набор закрыт или в компании нет свободных мест", 409);
    const age = ageOf(user.birthDate);
    if ((company.minAge != null || company.maxAge != null) && (age === null || (company.minAge != null && age < company.minAge) || (company.maxAge != null && age > company.maxAge))) throw new ApiError("AGE_RESTRICTION", "Возраст не соответствует правилам компании", 403);
    const pending = company.joinType === "request", ids = companyIdsFor(user.id);
    const application: Application = { id: Math.max(Date.now(), ...state.applications.map(item => item.id)) + 1, companyId: company.id, user, message: "По приглашению", status: pending ? "pending" : "approved", resolutionReason: null, createdAt: new Date().toISOString(), resolvedAt: pending ? null : new Date().toISOString() };
    commitDemo({ ...state, companyInvitations: { ...state.companyInvitations, [token]: { ...invitation, uses: invitation.uses + 1, redeemedBy: [...invitation.redeemedBy, user.id] } },
      companyMemberships: pending ? state.companyMemberships : { ...state.companyMemberships, [user.id]: [...ids, company.id] },
      companies: pending ? state.companies : state.companies.map(item => item.id === company.id ? { ...item, membersCount: item.membersCount + 1 } : item),
      events: pending ? state.events : state.events.map(item => item.id === event.id ? { ...item, participantsCount: item.participantsCount + 1 } : item),
      applications: [...state.applications, application] });
    return invitationPreview(token);
  },
  async listCoffeeMeetings(filters: CoffeeFilters = {}, options: PageOptions = {}) {
    await wait();
    const items = state.coffeeRecords.map(coffeeMeeting).filter((item): item is CoffeeMeeting => Boolean(item))
      .filter(item => (item.event.status === "active" || (item.participation === "owner" && item.event.status === "pending")) && item.company.status !== "blocked"
        && Date.parse(item.event.endsAt ?? item.event.startsAt) > Date.now() && (!filters.cityId || item.event.cityId === filters.cityId) && (!filters.topic || item.topic === filters.topic))
      .sort((a, b) => Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt));
    const current = Math.max(1, options.page ?? 1), limit = Math.max(1, options.limit ?? 20);
    return { ...page(items, current, limit), items: items.slice((current - 1) * limit, current * limit) };
  },
  async getCoffeeMeeting(id: number) {
    await wait();
    const record = state.coffeeRecords.find(item => item.id === id), item = record && coffeeMeeting(record);
    if (!item || item.company.status === "blocked" || (item.event.status !== "active" && item.participation !== "owner")) throw new ApiError("COFFEE_NOT_FOUND", "Встреча недоступна", 404);
    return item;
  },
  async createCoffeeMeeting(input: CoffeeInput) {
    const user = requireUser(); await wait();
    if (!user.isProfileComplete) throw new ApiError("PROFILE_INCOMPLETE", "Сначала заполните профиль", 403);
    const errors = validateCoffee(input, cities.map(city => city.id));
    if (Object.keys(errors).length) throw new ApiError("VALIDATION_ERROR", Object.values(errors)[0]!, 400, { fields: errors });
    const id = Math.max(Date.now(), ...state.events.map(item => item.id), ...state.companies.map(item => item.id)) + 1;
    const createdAt = new Date().toISOString(), description = input.description.trim(), title = input.title.trim();
    const event: Event = { id, title, description, categoryId: 5, cityId: input.cityId, startsAt: input.startsAt, endsAt: new Date(Date.parse(input.startsAt) + input.duration * 60000).toISOString(), locationName: input.locationName.trim(), address: input.address.trim() || null, location: null, imageUrl: coffeeCover, status: "active", moderationReason: null, participantsCount: 1, companiesCount: 1, creator: user, createdAt, updatedAt: createdAt };
    const group = company(id, id, title, description, input.maxMembers, 1, input.joinType, user);
    group.createdAt = createdAt; group.updatedAt = createdAt;
    group.rules = "Напитки каждый оплачивает самостоятельно. Если планы изменились, предупредите компанию.";
    const record: CoffeeRecord = { id, eventId: id, companyId: id, topic: input.topic };
    const next: State = { ...state, events: [...state.events, event], companies: [...state.companies, group], coffeeRecords: [...state.coffeeRecords, record], companyMemberships: { ...state.companyMemberships, [user.id]: [...companyIdsFor(user.id), id] } };
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { throw new ApiError("STORAGE_FULL", "Не удалось сохранить встречу. Освободите место в браузере и попробуйте снова.", 507); }
    state = next;
    return coffeeMeeting(record)!;
  },
  async dictionaries() { await wait(); return { cities, categories, interests }; },
  async login(_provider: "google" | "telegram" | "vk") { await wait(); state.user = demoUser; persist(); return { accessToken: `mock.${demoUser.id}.${Date.now()}`, user: demoUser }; },
  async register(_provider: "google" | "telegram" | "vk") { await wait(); const user: User = { ...demoUser, id: 100, firstName: "", lastName: null, city: null, about: null, interests: [], isProfileComplete: false }; state.user = user; persist(); return { accessToken: `mock.${user.id}.${Date.now()}`, user }; },
  async registerWithPassword(username: string, password: string) { await wait(); const login = username.trim().toLocaleLowerCase(); if (login.length < 3) throw new ApiError("VALIDATION_ERROR", "Логин должен состоять минимум из 3 символов", 400); if (password.length < 8) throw new ApiError("VALIDATION_ERROR", "Пароль должен состоять минимум из 8 символов", 400); if (passwordAccounts.has(login)) throw new ApiError("USERNAME_TAKEN", "Этот логин уже занят", 409); const user: User = { ...demoUser, id: Date.now(), firstName: "", lastName: null, city: null, about: null, interests: [], isProfileComplete: false }; passwordAccounts.set(login, { password, user }); state.users.push(user); state.user = user; persist(); return { accessToken: `mock.${user.id}.${Date.now()}`, user }; },
  async loginWithPassword(username: string, password: string) { await wait(); if (username === "admin" && password === "poydem2026") { state.user = adminUser; persist(); return { accessToken: `mock.admin.${Date.now()}`, user: adminUser }; } const account = passwordAccounts.get(username.trim().toLocaleLowerCase()); if (!account || account.password !== password) throw new ApiError("INVALID_CREDENTIALS", "Неверный логин или пароль", 401); state.user = account.user; persist(); return { accessToken: `mock.${account.user.id}.${Date.now()}`, user: account.user }; },
  async uploadMyAvatar(file: File) { const user = requireUser(); await wait(); if (!file.type.startsWith("image/")) throw new ApiError("UNSUPPORTED_AVATAR_TYPE", "Выберите изображение", 415); if (file.size > 5_242_880) throw new ApiError("AVATAR_TOO_LARGE", "Размер изображения не должен превышать 5 МБ", 413); const avatarUrl = URL.createObjectURL(file); state.user = { ...user, avatarUrl }; state.users = state.users.map((item) => item.id === user.id ? state.user as User : item); persist(); return { avatarUrl }; },
  async deleteMyAvatar() { const user = requireUser(); await wait(); state.user = { ...user, avatarUrl: null }; state.users = state.users.map((item) => item.id === user.id ? state.user as User : item); persist(); },
  async loginAdmin(username: string, password: string) {
    await wait();
    if (username !== "admin" || password !== "poydem2026") throw new ApiError("INVALID_CREDENTIALS", "Неверный логин или пароль", 401);
    return { accessToken: `mock.admin.${Date.now()}`, user: adminUser };
  },
  async logout() { await wait(); state.user = null; persist(); },
  async getCurrentUser() { await wait(); return requireUser(); },
  async getUserProfile(id: number) { await wait(); const item = state.users.find((user) => user.id === id); if (!item) throw new ApiError("USER_NOT_FOUND", "Пользователь не найден", 404); return item; },
  async listEvents(filters: EventFilters = {}, _options: PageOptions = {}) {
    const coffeeEventIds = new Set(state.coffeeRecords.map(item => item.eventId));
    await wait(); let result = state.events.filter((item) => item.status === "active" && !coffeeEventIds.has(item.id));
    if (filters.search) { const query = filters.search.toLocaleLowerCase("ru"); result = result.filter((item) => `${item.title} ${item.description ?? ""} ${item.locationName}`.toLocaleLowerCase("ru").includes(query)); }
    if (filters.cityId) result = result.filter((item) => item.cityId === filters.cityId);
    if (filters.categoryId) result = result.filter((item) => item.categoryId === filters.categoryId);
    const { west, south, east, north } = filters;
    if (west !== undefined && south !== undefined && east !== undefined && north !== undefined) result = result.filter(item => {
      const point = item.location;
      return point && point.latitude >= south && point.latitude <= north && (west <= east ? point.longitude >= west && point.longitude <= east : point.longitude >= west || point.longitude <= east);
    });
    result.sort(filters.sort === "popular" ? (a, b) => b.participantsCount - a.participantsCount : (a, b) => a.startsAt.localeCompare(b.startsAt)); return page(result);
  },
  async listFavorites(options: PageOptions = {}): Promise<Paginated<Favorite>> {
    const user = requireUser(); await wait();
    const saved = [...(state.favoritesByUser[String(user.id)] ?? [])].sort((a, b) => b.savedAt.localeCompare(a.savedAt) || b.eventId - a.eventId);
    const current = options.page ?? 1; const limit = options.limit ?? 20;
    const items = saved.slice((current - 1) * limit, current * limit).map(item => {
      const event = state.events.find(candidate => candidate.id === item.eventId);
      const available = !!event && event.status === "active";
      return { ...item, available, unavailableReason: available ? null : "EVENT_UNAVAILABLE", event: available ? event : null };
    });
    return { items, pagination: { page: current, limit, total: saved.length, totalPages: Math.ceil(saved.length / limit) } };
  },
  async saveFavorite(eventId: number) {
    const user = requireUser(); await wait();
    const saved = state.favoritesByUser[String(user.id)] ?? (state.favoritesByUser[String(user.id)] = []);
    if (saved.some(item => item.eventId === eventId)) return;
    const event = state.events.find(item => item.id === eventId && item.status === "active");
    if (!event) throw new ApiError("EVENT_NOT_FOUND", "Событие недоступно", 404);
    saved.push({ eventId, savedAt: new Date().toISOString() }); persist();
  },
  async removeFavorite(eventId: number) {
    const user = requireUser(); await wait();
    state.favoritesByUser[String(user.id)] = (state.favoritesByUser[String(user.id)] ?? []).filter(item => item.eventId !== eventId);
    persist();
  },
  async getEvent(id: number) { await wait(); const item = state.events.find((event) => event.id === id); if (!item) throw new ApiError("EVENT_NOT_FOUND", "Мероприятие не найдено", 404); return item; },
  async uploadEventCover(file: File) { await wait(); if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new ApiError("UNSUPPORTED_EVENT_COVER_TYPE", "Выберите JPG, PNG или WebP", 415); if (file.size > 10_485_760) throw new ApiError("EVENT_COVER_TOO_LARGE", "Размер обложки не должен превышать 10 МБ", 413); return { url: URL.createObjectURL(file) }; },
  async createEvent(input: EventInput) { const user = requireUser(); await wait(); if (!input.title.trim() || !input.categoryId || !input.cityId || !input.locationName.trim()) throw new ApiError("VALIDATION_ERROR", "Заполните обязательные поля", 400, { fields: { title: ["Обязательное поле"] } }); const item: Event = { ...input, id: Date.now(), title: input.title.trim(), status: "pending", moderationReason: null, participantsCount: 0, companiesCount: 0, creator: user, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; state.events.push(item); persist(); return item; },
  async updateOwnEvent(id: number, input: Partial<EventInput>) { const user = requireUser(); await wait(); const item = state.events.find((event) => event.id === id); if (!item) throw new ApiError("EVENT_NOT_FOUND", "Мероприятие не найдено", 404); if (item.creator.id !== user.id) throw new ApiError("EVENT_FORBIDDEN", "Можно редактировать только своё мероприятие", 403); Object.assign(item, input, { status: "pending", moderationReason: null, updatedAt: new Date().toISOString() }); persist(); return item; },
  async deleteOwnEvent(id: number) { const user = requireUser(); await wait(); const index = state.events.findIndex((event) => event.id === id && event.creator.id === user.id); if (index < 0) throw new ApiError("EVENT_FORBIDDEN", "Можно удалить только своё мероприятие", 403); state.events.splice(index, 1); persist(); },
  async listEventParticipants(id: number) { await wait(); const event = state.events.find((item) => item.id === id); if (!event) throw new ApiError("EVENT_NOT_FOUND", "Мероприятие не найдено", 404); const members = state.users.filter((user) => eventIdsFor(user.id).includes(id) || state.companies.some((company) => company.eventId === id && companyIdsFor(user.id).includes(company.id))); return page(members); },
  async listEventCompanies(eventId: number) { await wait(); return page(state.companies.filter((item) => item.eventId === eventId && item.status !== "blocked" && companyReadable(item))); },
  async getCompany(companyId: number) { await wait(); const company = state.companies.find((item) => item.id === companyId); if (!company || !companyReadable(company)) throw new ApiError("COMPANY_NOT_FOUND", "Компания не найдена", 404); return company; },
  async updateCompany(companyId: number, input: CompanyUpdate) { const user = requireUser(); const company = await this.getCompany(companyId); if (company.owner.id !== user.id) throw new ApiError("NOT_COMPANY_OWNER", "Только владелец может редактировать компанию", 403); if (input.maxMembers !== undefined && input.maxMembers < company.membersCount) throw new ApiError("COMPANY_CAPACITY_BELOW_MEMBERS", "Лимит не может быть меньше числа участников", 409); if (input.minAge !== undefined && input.maxAge !== undefined && input.minAge !== null && input.maxAge !== null && input.minAge > input.maxAge) throw new ApiError("VALIDATION_ERROR", "Некорректный возрастной диапазон", 400); Object.assign(company, input, { updatedAt: new Date().toISOString() }); persist(); return company; },
  async deleteCompany(companyId: number) { const user = requireUser(); const company = await this.getCompany(companyId); if (company.owner.id !== user.id) throw new ApiError("NOT_COMPANY_OWNER", "Только владелец может удалить компанию", 403); state.companies = state.companies.filter((item) => item.id !== companyId); Object.values(state.companyMemberships).forEach((ids) => { const index = ids.indexOf(companyId); if (index >= 0) ids.splice(index, 1); }); state.applications.forEach((item) => { if (item.companyId === companyId && item.status === "pending") { item.status = "cancelled"; item.resolutionReason = "EVENT_DELETED"; item.resolvedAt = new Date().toISOString(); } }); persist(); },
  async listCompanyMembers(companyId: number) { const company = await this.getCompany(companyId); const ids = new Set<number>([company.owner.id]); state.users.forEach((item) => { if (companyIdsFor(item.id).includes(companyId)) ids.add(item.id); }); return page(state.users.filter((item) => ids.has(item.id)).map(({ id, firstName, lastName, avatarUrl }) => ({ id, firstName, lastName, avatarUrl }))); },
  async leaveCompany(companyId: number) { const user = requireUser(); const company = await this.getCompany(companyId); if (company.owner.id === user.id) throw new ApiError("OWNER_CANNOT_LEAVE", "Владелец не может выйти из компании", 409); const ids = companyIdsFor(user.id); const index = ids.indexOf(companyId); if (index < 0) throw new ApiError("NOT_COMPANY_MEMBER", "Вы не состоите в компании", 409); ids.splice(index, 1); company.membersCount = Math.max(1, company.membersCount - 1); const event = state.events.find(item => item.id === company.eventId); if (event) event.participantsCount = Math.max(1, event.participantsCount - 1); persist(); },
  async removeCompanyMember(companyId: number, userId: number) { const user = requireUser(); const company = await this.getCompany(companyId); if (company.owner.id !== user.id) throw new ApiError("NOT_COMPANY_OWNER", "Только владелец может исключать участников", 403); if (company.owner.id === userId) throw new ApiError("OWNER_CANNOT_BE_REMOVED", "Нельзя исключить владельца", 409); const ids = companyIdsFor(userId); const index = ids.indexOf(companyId); if (index < 0) throw new ApiError("NOT_COMPANY_MEMBER", "Пользователь не состоит в компании", 409); ids.splice(index, 1); company.membersCount = Math.max(1, company.membersCount - 1); const event = state.events.find(item => item.id === company.eventId); if (event) event.participantsCount = Math.max(1, event.participantsCount - 1); persist(); },
  async joinOpenCompany(companyId: number) {
    const user = requireUser(); await wait(); const item = state.companies.find((entry) => entry.id === companyId);
    if (!item) throw new ApiError("COMPANY_NOT_FOUND", "Компания не найдена", 404);
    if (item.visibility === "private") throw new ApiError("INVITATION_REQUIRED", "Для закрытой компании нужна действующая ссылка приглашения", 403);
    ensureCoffeeRoomOpen(item);
    if (item.joinType !== "open" || item.status !== "active") throw new ApiError("COMPANY_CLOSED", "Компания принимает только заявки", 409);
    const age = ageOf(user.birthDate); if ((item.minAge != null || item.maxAge != null) && (age === null || (item.minAge != null && age < item.minAge) || (item.maxAge != null && age > item.maxAge))) throw new ApiError("AGE_RESTRICTION", "Вы не подходите по возрастному ограничению этой компании", 403);
    if (item.membersCount >= item.maxMembers) throw new ApiError("COMPANY_FULL", "В компании нет свободных мест", 409);
    if (companyIdsFor(user.id).includes(companyId)) throw new ApiError("ALREADY_COMPANY_MEMBER", "Вы уже в этой компании", 409);
    companyIdsFor(user.id).push(companyId); item.membersCount += 1; const event = state.events.find((entry) => entry.id === item.eventId); if (event) event.participantsCount += 1;
    state.applications.push({ id: Date.now(), companyId, user, message: null, status: "approved", resolutionReason: null, createdAt: new Date().toISOString(), resolvedAt: new Date().toISOString() }); persist();
  },
  async closeCompanyRecruitment(companyId: number) { const user = requireUser(); const company = await this.getCompany(companyId); if (company.owner.id !== user.id) throw new ApiError("NOT_COMPANY_OWNER", "Только владелец может закрыть набор", 403); company.status = "closed"; persist(); return company; },
  async openCompanyRecruitment(companyId: number) { const user = requireUser(); const company = await this.getCompany(companyId); if (company.owner.id !== user.id) throw new ApiError("NOT_COMPANY_OWNER", "Только владелец может открыть набор", 403); if (company.status === "blocked") throw new ApiError("COMPANY_BLOCKED", "Компания заблокирована", 409); company.status = "active"; persist(); return company; },
  async createCompanyApplication(companyId: number, message: string | null) {
    const user = requireUser(); await wait(); const item = state.companies.find((entry) => entry.id === companyId);
    if (!item) throw new ApiError("COMPANY_NOT_FOUND", "Компания не найдена", 404);
    if (item.visibility === "private") throw new ApiError("INVITATION_REQUIRED", "Для закрытой компании нужна действующая ссылка приглашения", 403);
    ensureCoffeeRoomOpen(item);
    if (item.owner.id === user.id || companyIdsFor(user.id).includes(companyId)) throw new ApiError("ALREADY_COMPANY_MEMBER", "Вы уже в этой компании", 409);
    const age = ageOf(user.birthDate); if ((item.minAge !== null || item.maxAge !== null) && (age === null || (item.minAge !== null && age < item.minAge) || (item.maxAge !== null && age > item.maxAge))) throw new ApiError("AGE_RESTRICTION", "Вы не подходите по возрастному ограничению этой компании", 403);
    if (state.applications.some((entry) => entry.companyId === companyId && entry.user.id === user.id && entry.status === "pending")) throw new ApiError("APPLICATION_ALREADY_EXISTS", "Заявка уже отправлена", 409);
    const application: Application = { id: Date.now(), companyId, user, message, status: "pending", resolutionReason: null, createdAt: new Date().toISOString(), resolvedAt: null }; state.applications.push(application); persist(); return application;
  },
  async getMyCompanyApplication(companyId: number) { const user = requireUser(); if (!state.companies.some(company => company.id === companyId)) throw new ApiError("COMPANY_NOT_FOUND", "Компания не найдена", 404); const item = [...state.applications].filter((entry) => entry.companyId === companyId && entry.user.id === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; if (!item) throw new ApiError("APPLICATION_NOT_FOUND", "Заявка не найдена", 404); return item; },
  async cancelMyCompanyApplication(companyId: number) { const item = await this.getMyCompanyApplication(companyId); if (item.status !== "pending") throw new ApiError("APPLICATION_ALREADY_RESOLVED", "Заявка уже обработана", 409); item.status = "cancelled"; item.resolvedAt = new Date().toISOString(); persist(); },
  async joinEventSolo(eventId: number) { const user = requireUser(); await wait(); if (eventIdsFor(user.id).includes(eventId)) throw new ApiError("ALREADY_EVENT_PARTICIPANT", "Вы уже идёте", 409); eventIdsFor(user.id).push(eventId); const item = state.events.find((entry) => entry.id === eventId); if (item) item.participantsCount += 1; persist(); return { status: 201 }; },
  async cancelEventSolo(eventId: number) { const user = requireUser(); await wait(); const ids = eventIdsFor(user.id); const index = ids.indexOf(eventId); if (index < 0) throw new ApiError("NOT_SOLO_PARTICIPANT", "Вы не записаны на мероприятие самостоятельно", 409); ids.splice(index, 1); const item = state.events.find((entry) => entry.id === eventId); if (item) item.participantsCount = Math.max(0, item.participantsCount - 1); persist(); },
  async createCompany(eventId: number, input: CompanyInput) {
    const user = requireUser(); await wait(); if (!input.name.trim()) throw new ApiError("VALIDATION_ERROR", "Введите название", 400, { fields: { name: ["Обязательное поле"] } });
    if (input.visibility && !["public", "private"].includes(input.visibility)) throw new ApiError("VALIDATION_ERROR", "Неверная видимость компании", 400);
    if (input.visibility === "private") { const event = state.events.find(item => item.id === eventId); if (!user.isProfileComplete) throw new ApiError("PROFILE_INCOMPLETE", "Заполните профиль", 403); if (!event || event.status !== "active" || Date.parse(event.endsAt || event.startsAt) <= Date.now()) throw new ApiError("EVENT_UNAVAILABLE", "Выберите действующее событие", 409); if (!Number.isInteger(input.maxMembers) || input.maxMembers < 2 || input.maxMembers > 100 || !["open", "request"].includes(input.joinType)) throw new ApiError("VALIDATION_ERROR", "Проверьте правила вступления и число участников", 400); }
    const item = { ...company(Math.max(Date.now(), ...state.companies.map(item => item.id)) + 1, eventId, input.name, input.description ?? "", input.maxMembers, 1, input.joinType, user), minAge: input.minAge ?? null, maxAge: input.maxAge ?? null, visibility: input.visibility ?? "public", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; commitDemo({ ...state, companies: [...state.companies, item], companyMemberships: { ...state.companyMemberships, [user.id]: [...companyIdsFor(user.id), item.id] }, events: state.events.map(event => event.id === eventId ? { ...event, companiesCount: event.companiesCount + 1, participantsCount: event.participantsCount + 1 } : event) }); return item;
  },
  async updateMyProfile(input: { firstName?: string; lastName?: string | null; cityId?: number; about?: string | null; interestIds?: number[]; gender?: User["gender"]; birthDate?: string | null }) { const user = requireUser(); await wait(); state.user = { ...user, ...input, city: input.cityId ? cities.find((city) => city.id === input.cityId) ?? user.city : user.city, interests: input.interestIds ? interests.filter((interest) => input.interestIds?.includes(interest.id)) : user.interests, isProfileComplete: Boolean((input.firstName ?? user.firstName) && (input.cityId ?? user.city?.id)) }; state.users = state.users.map((item) => item.id === state.user?.id ? state.user as User : item); persist(); return state.user; },
  async listMyApplications() { await wait(); const user = requireUser(); return page(state.applications.filter(item => item.user.id === user.id).reverse()); },
  async listCompanyApplications(companyId: number) { const user = requireUser(); await wait(); const company = state.companies.find((item) => item.id === companyId); if (!company || company.owner.id !== user.id) throw new ApiError("FORBIDDEN", "Только создатель компании может просматривать заявки", 403); return page(state.applications.filter((item) => item.companyId === companyId)); },
  async resolveCompanyApplication(companyId: number, applicationId: number, action: "approve" | "reject") { const user = requireUser(); await wait(); const company = state.companies.find((item) => item.id === companyId); const application = state.applications.find((item) => item.id === applicationId && item.companyId === companyId); if (!company || company.owner.id !== user.id || !application) throw new ApiError("FORBIDDEN", "Действие недоступно", 403); if (application.status !== "pending") throw new ApiError("APPLICATION_ALREADY_RESOLVED", "Заявка уже обработана", 409); const applicant = state.users.find((item) => item.id === application.user.id); const age = ageOf(applicant?.birthDate); if (action === "approve" && ((company.minAge !== null || company.maxAge !== null) && (age === null || (company.minAge !== null && age < company.minAge) || (company.maxAge !== null && age > company.maxAge)))) throw new ApiError("AGE_RESTRICTION", "Заявитель больше не подходит по возрастному ограничению", 403); if (action === "approve") { ensurePrivateCompanyOpen(company); ensureCoffeeRoomOpen(company); if (company.membersCount >= company.maxMembers) throw new ApiError("COMPANY_FULL", "В компании нет свободных мест", 409); if (companyIdsFor(application.user.id).includes(companyId)) throw new ApiError("ALREADY_COMPANY_MEMBER", "Пользователь уже в компании", 409); } application.status = action === "approve" ? "approved" : "rejected"; application.resolvedAt = new Date().toISOString(); if (action === "approve") { company.membersCount += 1; companyIdsFor(application.user.id).push(companyId); const event = state.events.find(item => item.id === company.eventId); if (event) event.participantsCount += 1; } persist(); return application; },
  async listMyCompanies() { const user = requireUser(); await wait(); return page(state.companies.filter((item) => companyIdsFor(user.id).includes(item.id) || item.owner.id === user.id)); },
  async listMyEvents() { const user = requireUser(); await wait(); const memberCompanyIds = companyIdsFor(user.id); const ids = new Set([...eventIdsFor(user.id), ...state.companies.filter((item) => memberCompanyIds.includes(item.id)).map((item) => item.eventId)]); return page(state.events.filter((item) => ids.has(item.id) || item.creator.id === user.id).map(item => ({ ...item, relation: item.creator.id === user.id ? ids.has(item.id) ? "creator_and_participant" as const : "creator" as const : "participant" as const }))); },
  async listCompanyMessages(companyId: number) { await wait(); requireCompanyMember(companyId); return page(companyMessages.get(companyId) ?? []); },
  async sendCompanyMessage(companyId: number, text: string) { const user = requireUser(); await wait(); requireCompanyMember(companyId); if (!text.trim()) throw new ApiError("VALIDATION_ERROR", "Введите сообщение", 400); const item: CompanyMessage = { id: Date.now(), companyId, author: user, text: text.trim(), createdAt: new Date().toISOString() }; companyMessages.set(companyId, [...(companyMessages.get(companyId) ?? []), item]); return item; },
  async createReport(input: { targetType: "user" | "company" | "event"; targetId: number; reason: string; description: string | null }) { const user = requireUser(); await wait(); const item: Report = { ...input, id: Date.now(), author: user, status: "pending", resolvedBy: null, createdAt: new Date().toISOString(), resolvedAt: null }; state.reports.push(item); persist(); return item; },
  async getAdminDashboard() { await wait(); return { usersTotal: state.users.length, activeEvents: state.events.filter((item) => item.status === "active").length, pendingReports: state.reports.filter((item) => item.status === "pending").length, newRegistrations30d: state.users.filter((item) => item.id !== adminUser.id).length }; },
  async listAdminUsers(search = "") { await wait(); const query = search.toLocaleLowerCase("ru"); return page(state.users.filter((item) => `${item.firstName} ${item.lastName ?? ""}`.toLocaleLowerCase("ru").includes(query))); },
  async getAdminUser(id: number) { await wait(); const item = state.users.find((entry) => entry.id === id); if (!item) throw new ApiError("USER_NOT_FOUND", "Пользователь не найден", 404); return item; },
  async setAdminUserStatus(id: number, status: User["status"]) { const item = await this.getAdminUser(id); if (item.role === "admin") throw new ApiError("FORBIDDEN", "Администратора нельзя заблокировать", 403); item.status = status; persist(); return item; },
  async listAdminEvents(search = "", status?: Event["status"]) { await wait(); const query = search.toLocaleLowerCase("ru"); return page(state.events.filter((item) => (!status || item.status === status) && `${item.title} ${item.locationName}`.toLocaleLowerCase("ru").includes(query))); },
  async getAdminEvent(id: number) { return this.getEvent(id); },
  async updateAdminEvent(id: number, input: Partial<Event>) { const item = state.events.find((entry) => entry.id === id); if (!item) throw new ApiError("EVENT_NOT_FOUND", "Мероприятие не найдено", 404); Object.assign(item, input, { updatedAt: new Date().toISOString() }); persist(); return item; },
  async moderateAdminEvent(id: number, status: Event["status"], reason?: string) { return this.updateAdminEvent(id, { status, moderationReason: reason ?? null }); },
  async listAdminCompanies() { await wait(); return page(state.companies); },
  async blockAdminCompany(id: number) { const item = state.companies.find((entry) => entry.id === id); if (!item) throw new ApiError("COMPANY_NOT_FOUND", "Компания не найдена", 404); item.status = "blocked"; state.applications.forEach((application) => { if (application.companyId === id && application.status === "pending") { application.status = "cancelled"; application.resolutionReason = "COMPANY_BLOCKED"; application.resolvedAt = new Date().toISOString(); } }); persist(); return item; },
  async unblockAdminCompany(id: number) { const item = state.companies.find((entry) => entry.id === id); if (!item) throw new ApiError("COMPANY_NOT_FOUND", "Компания не найдена", 404); item.status = "active"; persist(); return item; },
  async listAdminReports(status?: Report["status"]) { await wait(); return page(state.reports.filter((item) => !status || item.status === status)); },
  async moderateAdminReport(id: number, status: "resolved" | "rejected") { const item = state.reports.find((entry) => entry.id === id); if (!item) throw new ApiError("REPORT_NOT_FOUND", "Жалоба не найдена", 404); item.status = status; item.resolvedBy = adminUser; item.resolvedAt = new Date().toISOString(); persist(); return item; },
  reset() { localStorage.removeItem(storageKey); state = fresh(); window.location.reload(); },
};
