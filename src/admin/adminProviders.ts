import type { AuthProvider, DataProvider, GetListParams, GetManyParams, GetManyReferenceParams, GetOneParams, RaRecord, UpdateManyParams, UpdateParams } from "react-admin";
import { api, backendMode } from "../api";
import { backendApi } from "../api/backendApi";
import { collectPages } from "../api/pagination";
import type { Company, Event, Report, User } from "../api/types";
import { ADMIN_SESSION_KEY, createAdminSession, readAdminSession } from "./adminSession";

export const adminAuthProvider: AuthProvider = {
  async login({ username, password }) {
    await createAdminSession(String(username ?? ""), String(password ?? ""));
  },
  async logout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  },
  async checkAuth() {
    if (readAdminSession()) return;
    // In backend mode an OAuth callback returns here with a refresh cookie but
    // without a browser-side session record. Restore the admin identity once.
    await createAdminSession("", "");
  },
  async checkError(error) {
    if (error?.status === 401 || error?.status === 403) {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      throw error;
    }
  },
  async getIdentity() {
    const session = readAdminSession();
    if (!session) throw new Error("Требуется вход администратора");
    return { id: session.id, fullName: session.fullName };
  },
  async getPermissions() {
    return readAdminSession()?.role ?? null;
  },
  async canAccess() {
    return readAdminSession()?.role === "admin";
  },
};

function sortAndPaginate<T extends RaRecord>(items: T[], params: { pagination?: { page: number; perPage: number }; sort?: { field: string; order: string } }) {
  const sorted = [...items];
  if (params.sort) {
    const { field, order } = params.sort;
    sorted.sort((left, right) => {
      const a = left[field];
      const b = right[field];
      return String(a ?? "").localeCompare(String(b ?? ""), "ru", { numeric: true }) * (order === "ASC" ? 1 : -1);
    });
  }
  const page = params.pagination?.page ?? 1;
  const perPage = params.pagination?.perPage ?? 25;
  const start = (page - 1) * perPage;
  return { data: sorted.slice(start, start + perPage), total: sorted.length };
}

async function getAll(resource: string, filter: Record<string, unknown> = {}): Promise<RaRecord[]> {
  if (resource === "users") return (await collectPages(options => backendMode ? backendApi.listAdminUsers(String(filter.q ?? ""), options) : api.listAdminUsers(String(filter.q ?? "")))).items as unknown as RaRecord[];
  if (resource === "events") return (await collectPages(options => backendMode ? backendApi.listAdminEvents(String(filter.q ?? ""), filter.status as Event["status"] | undefined, options) : api.listAdminEvents(String(filter.q ?? ""), filter.status as Event["status"] | undefined))).items as unknown as RaRecord[];
  if (resource === "companies") return (await collectPages(options => backendMode ? backendApi.listAdminCompanies(options) : api.listAdminCompanies())).items as unknown as RaRecord[];
  if (resource === "reports") return (await collectPages(options => backendMode ? backendApi.listAdminReports(filter.status as Report["status"] | undefined, options) : api.listAdminReports(filter.status as Report["status"] | undefined))).items as unknown as RaRecord[];
  throw new Error(`Неизвестный ресурс: ${resource}`);
}

type AdminMutation = Partial<AdminResource> & { _moderation?: boolean; moderationReason?: string | null };

async function updateResource(resource: string, id: string | number, data: AdminMutation): Promise<RaRecord> {
  if (resource === "users") return await api.setAdminUserStatus(Number(id), (data as User).status) as unknown as RaRecord;
  if (resource === "events") {
    if (data._moderation) return await api.moderateAdminEvent(Number(id), (data as Event).status, data.moderationReason ?? undefined) as unknown as RaRecord;
    const { _moderation: _ignored, moderationReason: _reason, status: _status, ...eventPatch } = data;
    return await api.updateAdminEvent(Number(id), eventPatch as Partial<Event>) as unknown as RaRecord;
  }
  if (resource === "companies") return await ((data as Company).status === "active" ? api.unblockAdminCompany(Number(id)) : api.blockAdminCompany(Number(id))) as unknown as RaRecord;
  if (resource === "reports") return await api.moderateAdminReport(Number(id), (data as Report).status as "resolved" | "rejected") as unknown as RaRecord;
  throw new Error(`Изменение ресурса ${resource} не поддерживается`);
}

const dataProvider = {
  async getList(resource: string, params: GetListParams) {
    if (backendMode) {
      const options = { page: params.pagination?.page ?? 1, limit: params.pagination?.perPage ?? 25 };
      const filter = params.filter ?? {};
      const result = resource === "users" ? await api.listAdminUsers(String(filter.q ?? ""), options)
        : resource === "events" ? await api.listAdminEvents(String(filter.q ?? ""), filter.status as Event["status"] | undefined, options)
        : resource === "companies" ? await api.listAdminCompanies(options)
        : resource === "reports" ? await api.listAdminReports(filter.status as Report["status"] | undefined, options)
        : null;
      if (!result) throw new Error(`Неизвестный ресурс: ${resource}`);
      return { data: result.items as RaRecord[], total: result.pagination.total };
    }
    const items = await getAll(resource, params.filter);
    return sortAndPaginate(items, params);
  },
  async getOne(resource: string, params: GetOneParams<RaRecord>) {
    if (resource === "users") return { data: await api.getAdminUser(Number(params.id)) as unknown as RaRecord };
    if (resource === "events") return { data: await api.getAdminEvent(Number(params.id)) as unknown as RaRecord };
    const items = await getAll(resource);
    const item = items.find((entry) => entry.id === params.id);
    if (!item) throw new Error("Запись не найдена");
    return { data: item };
  },
  async getMany(resource: string, params: GetManyParams<RaRecord>) {
    const items = await getAll(resource);
    return { data: items.filter((entry) => params.ids.includes(entry.id)) };
  },
  async getManyReference(resource: string, params: GetManyReferenceParams) {
    const items = await getAll(resource, params.filter);
    const filtered = items.filter((entry) => entry[params.target] === params.id);
    return sortAndPaginate(filtered, params);
  },
  async update(resource: string, params: UpdateParams<RaRecord>) {
    return { data: await updateResource(resource, params.id, params.data as Partial<AdminResource>) };
  },
  async updateMany(resource: string, params: UpdateManyParams<RaRecord>) {
    await Promise.all(params.ids.map((id) => updateResource(resource, id, params.data as Partial<AdminResource>)));
    return { data: params.ids };
  },
  async create() {
    throw new Error("Создание из административной панели не поддерживается контрактом");
  },
  async delete() {
    throw new Error("Удаление не поддерживается контрактом");
  },
  async deleteMany() {
    throw new Error("Удаление не поддерживается контрактом");
  },
};

export const adminDataProvider = dataProvider as unknown as DataProvider;

export type AdminResource = User | Event | Company | Report;
