import type { CompanyInput, CompanyInvitation, CompanyInvitationOptions, CompanyInvitationPreview, Application, Company, CompanyMessage, CompanyUpdate, DictionaryItem, Event, EventFilters, EventInput, Favorite, PageOptions, Paginated, Report, User, UserShort } from "./types";
import { ApiError } from "./types";
import type { CoffeeFilters, CoffeeInput, CoffeeMeeting } from "./coffeeTypes";
import type { SiteNotification } from "./notificationTypes";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/$/, "");
const API_PREFIX = `${BACKEND_URL}/api/v1`;
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

// Browsers cannot attach an Authorization header during the WebSocket handshake.
// The backend must validate this short-lived token from the query string.
export async function getChatAccessToken() {
  if (!accessToken) await refresh();
  if (!accessToken) throw new ApiError("UNAUTHORIZED", "Сначала войдите в аккаунт", 401);
  return accessToken;
}
export async function refreshChatAccessToken() { return refresh(); }

function query(params: Record<string, string | number | undefined>) {
  const value = new URLSearchParams();
  Object.entries(params).forEach(([key, item]) => { if (item !== undefined && item !== "") value.set(key, String(item)); });
  const encoded = value.toString();
  return encoded ? `?${encoded}` : "";
}

async function refresh() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_PREFIX}/auth/refresh`, { method: "POST", credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw await toError(response);
        const body = await response.json() as { accessToken: string };
        accessToken = body.accessToken;
        return body.accessToken;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function toError(response: Response) {
  const fallback = `Ошибка API (${response.status})`;
  try {
    const body = await response.json() as { error?: { code?: string; message?: string; details?: Record<string, unknown> } };
    return new ApiError(body.error?.code ?? "API_ERROR", body.error?.message ?? fallback, response.status, body.error?.details ?? {}, response.headers.get("X-Request-ID") ?? crypto.randomUUID());
  } catch {
    return new ApiError("API_ERROR", fallback, response.status);
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_PREFIX}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    await refresh();
    return request<T>(path, init, false);
  }
  if (!response.ok) throw await toError(response);
  if (response.status === 204) return undefined as T;
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

const page = <T>(items: T[]): Paginated<T> => ({ items, pagination: { page: 1, limit: items.length, total: items.length, totalPages: items.length ? 1 : 0 } });

export const backendApi = {
  async listNotifications(options: PageOptions = {}) { return request<Paginated<SiteNotification>>(`/users/me/notifications${query({ page: options.page ?? 1, limit: options.limit ?? 30 })}`); },
  async markNotificationsRead(ids: string[]) { return request<void>("/users/me/notifications/read", { method: "POST", body: JSON.stringify({ ids }) }); },
  async getCompanyInvitation(companyId: number) { return request<CompanyInvitation | null>(`/companies/${companyId}/invitation`); },
  async createCompanyInvitation(companyId: number, input: CompanyInvitationOptions) { return request<CompanyInvitation>(`/companies/${companyId}/invitation`, { method: "POST", body: JSON.stringify(input) }); },
  async revokeCompanyInvitation(companyId: number) { return request<void>(`/companies/${companyId}/invitation`, { method: "DELETE" }); },
  async previewCompanyInvitation(token: string) { return request<CompanyInvitationPreview>(`/company-invitations/${encodeURIComponent(token)}`); },
  async redeemCompanyInvitation(token: string) { return request<CompanyInvitationPreview>(`/company-invitations/${encodeURIComponent(token)}/redeem`, { method: "POST" }); },
  async listCoffeeMeetings(filters: CoffeeFilters = {}, options: PageOptions = {}) { return request<Paginated<CoffeeMeeting>>(`/coffee-meetings${query({ ...filters, page: options.page ?? 1, limit: options.limit ?? 20 })}`); },
  async getCoffeeMeeting(id: number) { return request<CoffeeMeeting>(`/coffee-meetings/${id}`); },
  async createCoffeeMeeting(input: CoffeeInput) { return request<CoffeeMeeting>("/coffee-meetings", { method: "POST", body: JSON.stringify(input) }); },
  async dictionaries() {
    const [cities, interests, categories] = await Promise.all([
      request<DictionaryItem[]>("/cities"), request<DictionaryItem[]>("/interests"), request<DictionaryItem[]>("/event-categories"),
    ]);
    return { cities, interests, categories };
  },
  async login(provider: "google" | "telegram" | "vk") {
    window.location.assign(`${API_PREFIX}/auth/${provider}`);
    return new Promise<never>(() => undefined);
  },
  async register(provider: "google" | "telegram" | "vk") { return this.login(provider); },
  async registerWithPassword(username: string, password: string) { const result = await request<{ accessToken: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }, false); accessToken = result.accessToken; return result; },
  async loginWithPassword(username: string, password: string) { const result = await request<{ accessToken: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }, false); accessToken = result.accessToken; return result; },
  async uploadMyAvatar(file: File) { const form = new FormData(); form.append("file", file); return request<{ avatarUrl: string }>("/users/me/avatar", { method: "POST", body: form }); },
  async deleteMyAvatar() { return request<void>("/users/me/avatar", { method: "DELETE" }); },
  async logout() { await request<void>("/auth/logout", { method: "POST" }, false); accessToken = null; },
  async getCurrentUser() { if (!accessToken) await refresh(); return request<User>("/auth/me"); },
  async getUserProfile(id: number) { return request<User>(`/users/${id}`); },
  async listEvents(filters: EventFilters = {}, options: PageOptions = {}) { return request<Paginated<Event>>(`/events${query({ ...filters, page: options.page ?? 1, limit: options.limit ?? 24 })}`); },
  async listFavorites(options: PageOptions = {}) { return request<Paginated<Favorite>>(`/users/me/favorites${query({ page: options.page ?? 1, limit: options.limit ?? 20 })}`); },
  async saveFavorite(eventId: number) { return request<void>(`/users/me/favorites/${eventId}`, { method: "PUT" }); },
  async removeFavorite(eventId: number) { return request<void>(`/users/me/favorites/${eventId}`, { method: "DELETE" }); },
  async getEvent(id: number) { return request<Event>(`/events/${id}`); },
  async uploadEventCover(file: File) { const form = new FormData(); form.append("file", file); return request<{ url: string }>("/uploads/events", { method: "POST", body: form }); },
  async createEvent(input: EventInput) { return request<Event>("/events", { method: "POST", body: JSON.stringify(input) }); },
  async updateOwnEvent(id: number, input: Partial<EventInput>) { return request<Event>(`/events/${id}`, { method: "PATCH", body: JSON.stringify(input) }); },
  async deleteOwnEvent(id: number) { return request<void>(`/events/${id}`, { method: "DELETE" }); },
  async listEventParticipants(id: number, options: PageOptions = {}) { return request<Paginated<UserShort>>(`/events/${id}/participants${query({ page: options.page ?? 1, limit: options.limit ?? 20 })}`); },
  async listEventCompanies(eventId: number, options: PageOptions = {}) { return request<Paginated<Company>>(`/events/${eventId}/companies${query({ page: options.page ?? 1, limit: options.limit ?? 20 })}`); },
  async getCompany(companyId: number) { return request<Company>(`/companies/${companyId}`); },
  async updateCompany(companyId: number, input: CompanyUpdate) { return request<Company>(`/companies/${companyId}`, { method: "PATCH", body: JSON.stringify(input) }); },
  async deleteCompany(companyId: number) { return request<void>(`/companies/${companyId}`, { method: "DELETE" }); },
  async listCompanyMembers(companyId: number, options: PageOptions = {}) { return request<Paginated<UserShort>>(`/companies/${companyId}/members${query({ page: options.page ?? 1, limit: options.limit ?? 20 })}`); },
  async leaveCompany(companyId: number) { return request<void>(`/companies/${companyId}/members/me`, { method: "DELETE" }); },
  async removeCompanyMember(companyId: number, userId: number) { return request<void>(`/companies/${companyId}/members/${userId}`, { method: "DELETE" }); },
  async joinOpenCompany(companyId: number) { return request<void>(`/companies/${companyId}/join`, { method: "POST" }); },
  async closeCompanyRecruitment(companyId: number) { return request<Company>(`/companies/${companyId}/close`, { method: "POST" }); },
  async openCompanyRecruitment(companyId: number) { return request<Company>(`/companies/${companyId}/open`, { method: "POST" }); },
  async createCompanyApplication(companyId: number, message: string | null) { return request<Application>(`/companies/${companyId}/applications`, { method: "POST", body: JSON.stringify({ message }) }); },
  async getMyCompanyApplication(companyId: number) { return request<Application>(`/companies/${companyId}/applications/me`); },
  async cancelMyCompanyApplication(companyId: number) { return request<void>(`/companies/${companyId}/applications/me`, { method: "DELETE" }); },
  async joinEventSolo(eventId: number) { return request<void>(`/events/${eventId}/solo-participation`, { method: "POST" }); },
  async cancelEventSolo(eventId: number) { return request<void>(`/events/${eventId}/solo-participation`, { method: "DELETE" }); },
  async createCompany(eventId: number, input: CompanyInput) {
    const { visibility, ...publicInput } = input;
    const privateCompany = visibility === "private";
    const result = await request<Company>(`/events/${eventId}/${privateCompany ? "private-companies" : "companies"}`, { method: "POST", body: JSON.stringify(privateCompany ? input : publicInput) });
    if (privateCompany && result.visibility !== "private") throw new ApiError("PRIVACY_NOT_SUPPORTED", "Сервер не подтвердил закрытую видимость компании. Проверьте API.", 502);
    return result;
  },
  async createReport(input: { targetType: "user" | "company" | "event"; targetId: number; reason: string; description: string | null }) { return request<Report>("/reports", { method: "POST", body: JSON.stringify(input) }); },
  async updateMyProfile(input: { firstName?: string; lastName?: string | null; cityId?: number; about?: string | null; interestIds?: number[]; gender?: User["gender"]; birthDate?: string | null }) { return request<User>("/users/me", { method: "PATCH", body: JSON.stringify(input) }); },
  async listMyApplications(options: PageOptions = {}) { return request<Paginated<Application>>(`/users/me/applications${query({ page: options.page ?? 1, limit: options.limit ?? 20 })}`); },
  async listCompanyApplications(companyId: number, options: PageOptions = {}) { return request<Paginated<Application>>(`/companies/${companyId}/applications${query({ status: "pending", page: options.page ?? 1, limit: options.limit ?? 20 })}`); },
  async resolveCompanyApplication(companyId: number, applicationId: number, action: "approve" | "reject") { return request<Application>(`/companies/${companyId}/applications/${applicationId}/${action}`, { method: "POST" }); },
  async listMyCompanies(options: PageOptions = {}) { return request<Paginated<Company>>(`/users/me/companies${query({ page: options.page ?? 1, limit: options.limit ?? 20 })}`); },
  async listMyEvents(options: PageOptions = {}) { return request<Paginated<Event>>(`/users/me/events${query({ status: "upcoming", page: options.page ?? 1, limit: options.limit ?? 20 })}`); },
  async listCompanyMessages(companyId: number, options: PageOptions = {}) { return request<Paginated<CompanyMessage>>(`/companies/${companyId}/messages${query({ page: options.page ?? 1, limit: options.limit ?? 20 })}`); },
  async sendCompanyMessage(companyId: number, text: string) { return request<CompanyMessage>(`/companies/${companyId}/messages`, { method: "POST", body: JSON.stringify({ text }) }); },
  async loginAdmin(username: string, password: string) {
    const result = await this.loginWithPassword(username, password);
    const { user } = result;
    if (user.role !== "admin") throw new ApiError("FORBIDDEN", "У этой учётной записи нет прав администратора", 403);
    return result;
  },
  async getAdminDashboard() { return request<{ usersTotal: number; activeEvents: number; pendingReports: number; newRegistrations30d: number }>("/admin/dashboard"); },
  async listAdminUsers(search = "", options: PageOptions = {}) { return request<Paginated<User>>(`/admin/users${query({ search, page: options.page ?? 1, limit: options.limit ?? 25 })}`); },
  async getAdminUser(id: number) { return request<User>(`/admin/users/${id}`); },
  async setAdminUserStatus(id: number, status: User["status"]) { return request<User>(`/admin/users/${id}/${status === "banned" ? "ban" : "unban"}`, { method: "POST" }); },
  async listAdminEvents(search = "", status?: Event["status"], options: PageOptions = {}) { return request<Paginated<Event>>(`/admin/events${query({ search, status, page: options.page ?? 1, limit: options.limit ?? 25 })}`); },
  async getAdminEvent(id: number) { return request<Event>(`/admin/events/${id}`); },
  async updateAdminEvent(id: number, input: Partial<Event>) { return request<Event>(`/admin/events/${id}`, { method: "PATCH", body: JSON.stringify(input) }); },
  async moderateAdminEvent(id: number, status: Event["status"], reason?: string) { const action = status === "active" ? "approve" : status === "blocked" ? "block" : "reject"; return request<Event>(`/admin/events/${id}/${action}`, { method: "POST", body: reason ? JSON.stringify({ reason }) : undefined }); },
  async listAdminCompanies(options: PageOptions = {}) { return request<Paginated<Company>>(`/admin/companies${query({ page: options.page ?? 1, limit: options.limit ?? 25 })}`); },
  async blockAdminCompany(id: number) { return request<Company>(`/admin/companies/${id}/block`, { method: "POST" }); },
  async unblockAdminCompany(id: number) { return request<Company>(`/admin/companies/${id}/unblock`, { method: "POST" }); },
  async listAdminReports(status?: Report["status"], options: PageOptions = {}) { return request<Paginated<Report>>(`/admin/reports${query({ status, page: options.page ?? 1, limit: options.limit ?? 25 })}`); },
  async moderateAdminReport(id: number, status: "resolved" | "rejected") { return request<Report>(`/admin/reports/${id}/${status === "resolved" ? "resolve" : "reject"}`, { method: "POST" }); },
  reset() { window.location.reload(); },
};

export const backendMode = import.meta.env.VITE_API_MODE === "backend";
