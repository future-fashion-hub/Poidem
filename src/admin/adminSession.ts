import { api as mockApi } from "../api";

export const ADMIN_SESSION_KEY = "poydem_admin_session";

export type AdminSession = {
  id: number;
  fullName: string;
  role: "admin";
};

export async function createAdminSession(username: string, password: string) {
  const result = await mockApi.loginAdmin(username.trim(), password);
  const session: AdminSession = {
    id: result.user.id,
    fullName: `${result.user.firstName} ${result.user.lastName ?? ""}`.trim(),
    role: "admin",
  };
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function readAdminSession(): AdminSession | null {
  try {
    const value = sessionStorage.getItem(ADMIN_SESSION_KEY);
    return value ? JSON.parse(value) as AdminSession : null;
  } catch {
    return null;
  }
}
