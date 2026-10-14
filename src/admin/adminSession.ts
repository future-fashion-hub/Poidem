import { api, backendMode } from "../api";
import { ApiError, type User } from "../api/types";

export const ADMIN_SESSION_KEY = "poydem_admin_session";

export type AdminSession = {
  id: number;
  fullName: string;
  role: "admin";
};

export async function createAdminSession(username: string, password: string) {
  const result = await api.loginAdmin(username.trim(), password);
  return saveAdminSession(result.user);
}

function saveAdminSession(user: User) {
  if (user.role !== "admin" || user.status !== "active") throw new ApiError("FORBIDDEN", "У этой учётной записи нет доступа к админ-панели", 403);
  const session: AdminSession = {
    id: user.id,
    fullName: `${user.firstName} ${user.lastName ?? ""}`.trim(),
    role: "admin",
  };
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  return session;
}

let restoring: Promise<AdminSession> | null = null;
export async function restoreAdminSession(): Promise<AdminSession> {
  if (!backendMode) {
    const session = readAdminSession();
    if (!session) throw new ApiError("UNAUTHORIZED", "Требуется вход администратора", 401);
    return session;
  }
  if (!restoring) restoring = api.getCurrentUser().then(saveAdminSession).finally(() => { restoring = null; });
  return restoring;
}

export function readAdminSession(): AdminSession | null {
  try {
    const value = sessionStorage.getItem(ADMIN_SESSION_KEY);
    const session = value ? JSON.parse(value) as AdminSession : null;
    return session && session.role === "admin" && Number.isFinite(session.id) && typeof session.fullName === "string" ? session : null;
  } catch {
    return null;
  }
}
