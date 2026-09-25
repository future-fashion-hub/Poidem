import type { Application, Company, CompanyMessage, DictionaryItem, Event, Paginated, Report, User } from "./types";
import { ApiError } from "./types";

const API_PREFIX = "/api/v1";
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

type EventFilters = { search?: string; cityId?: number; categoryId?: number; sort?: string };

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
  return response.json() as Promise<T>;
}

const page = <T>(items: T[]): Paginated<T> => ({ items, pagination: { page: 1, limit: items.length, total: items.length, totalPages: items.length ? 1 : 0 } });

export const backendApi = {
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
  async logout() { await request<void>("/auth/logout", { method: "POST" }, false); accessToken = null; },
  async getCurrentUser() { if (!accessToken) await refresh(); return request<User>("/auth/me"); },
  async getUserProfile(id: number) { return request<User>(`/users/${id}`); },
  async listEvents(filters: EventFilters = {}) { return request<Paginated<Event>>(`/events${query({ ...filters, page: 1, limit: 100 })}`); },
  async getEvent(id: number) { return request<Event>(`/events/${id}`); },
  async listEventCompanies(eventId: number) { return request<Paginated<Company>>(`/events/${eventId}/companies?page=1&limit=100`); },
  async joinOpenCompany(companyId: number) { return request<void>(`/companies/${companyId}/join`, { method: "POST" }); },
  async createCompanyApplication(companyId: number, message: string | null) { return request<Application>(`/companies/${companyId}/applications`, { method: "POST", body: JSON.stringify({ message }) }); },
  async joinEventSolo(eventId: number) { return request<void>(`/events/${eventId}/solo-participation`, { method: "POST" }); },
  async createCompany(eventId: number, input: { name: string; description: string | null; maxMembers: number; joinType: "open" | "request" }) { return request<Company>(`/events/${eventId}/companies`, { method: "POST", body: JSON.stringify(input) }); },
  async updateMyProfile(input: { firstName?: string; lastName?: string | null; cityId?: number; about?: string | null; interestIds?: number[] }) { return request<User>("/users/me", { method: "PATCH", body: JSON.stringify(input) }); },
  async listMyApplications() { return request<Paginated<Application>>("/users/me/applications?page=1&limit=100"); },
  async listCompanyApplications(companyId: number) { return request<Paginated<Application>>(`/companies/${companyId}/applications?status=pending&page=1&limit=100`); },
  async resolveCompanyApplication(companyId: number, applicationId: number, action: "approve" | "reject") { return request<Application>(`/companies/${companyId}/applications/${applicationId}/${action}`, { method: "POST" }); },
  async listMyCompanies() { return request<Paginated<Company>>("/users/me/companies?page=1&limit=100"); },
  async listMyEvents() { return request<Paginated<Event>>("/users/me/events?status=upcoming&page=1&limit=100"); },
  async listCompanyMessages(companyId: number) { return request<Paginated<CompanyMessage>>(`/companies/${companyId}/messages?page=1&limit=100`); },
  async sendCompanyMessage(companyId: number, text: string) { return request<CompanyMessage>(`/companies/${companyId}/messages`, { method: "POST", body: JSON.stringify({ text }) }); },
  async loginAdmin(_username: string, _password: string) {
    const user = await this.getCurrentUser();
    if (user.role !== "admin") throw new ApiError("FORBIDDEN", "У этой учётной записи нет прав администратора", 403);
    return { accessToken: accessToken ?? "", user };
  },
  async getAdminDashboard() { return request<{ usersTotal: number; activeEvents: number; pendingReports: number; newRegistrations30d: number }>("/admin/dashboard"); },
  async listAdminUsers(_search = "") { return request<Paginated<User>>("/admin/users?page=1&limit=100"); },
  async getAdminUser(id: number) { return request<User>(`/admin/users/${id}`); },
  async setAdminUserStatus(id: number, status: User["status"]) { return request<User>(`/admin/users/${id}/${status === "banned" ? "ban" : "unban"}`, { method: "POST" }); },
  async listAdminEvents(_search = "", status?: Event["status"]) { return request<Paginated<Event>>(`/admin/events${query({ status, page: 1, limit: 100 })}`); },
  async updateAdminEvent(id: number, input: Partial<Event>) { return request<Event>(`/admin/events/${id}`, { method: "PATCH", body: JSON.stringify(input) }); },
  async moderateAdminEvent(id: number, status: Event["status"]) { const action = status === "active" ? "approve" : status === "blocked" ? "block" : "reject"; return request<Event>(`/admin/events/${id}/${action}`, { method: "POST" }); },
  async listAdminCompanies() { return request<Paginated<Company>>("/admin/companies?page=1&limit=100"); },
  async blockAdminCompany(id: number) { return request<Company>(`/admin/companies/${id}/block`, { method: "POST" }); },
  async listAdminReports(status?: Report["status"]) { return request<Paginated<Report>>(`/admin/reports${query({ status, page: 1, limit: 100 })}`); },
  async moderateAdminReport(id: number, status: "resolved" | "rejected") { return request<Report>(`/admin/reports/${id}/${status === "resolved" ? "resolve" : "reject"}`, { method: "POST" }); },
  reset() { window.location.reload(); },
};

export const backendMode = import.meta.env.VITE_API_MODE === "backend";
