import { backendMode, getChatAccessToken } from "./backendApi";
import type { CompanyMessage } from "./types";

export type ChatConnection = { send: (text: string) => void; close: () => void };
type SocketEvent = { type: "message.created"; payload: CompanyMessage } | { type: "error"; payload: { code: string; message: string } };

function chatBaseUrl() {
  const explicit = import.meta.env.VITE_CHAT_WS_URL as string | undefined;
  if (explicit) return explicit.replace(/\/$/, "");
  const apiBase = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "");
  return apiBase ? `${apiBase.replace(/^http/, "ws")}/api/v1/ws` : "";
}

export async function connectCompanyChat(companyId: number, onMessage: (message: CompanyMessage) => void, onState: (state: "connecting" | "connected" | "disconnected" | "error") => void): Promise<ChatConnection | null> {
  if (!backendMode || !chatBaseUrl()) return null;
  const token = await getChatAccessToken();
  const url = new URL(`${chatBaseUrl()}/companies/${companyId}`);
  url.searchParams.set("access_token", token);
  onState("connecting");
  const socket = new WebSocket(url);
  socket.onopen = () => onState("connected");
  socket.onclose = () => onState("disconnected");
  socket.onerror = () => onState("error");
  socket.onmessage = (event) => { try { const data = JSON.parse(event.data) as SocketEvent; if (data.type === "message.created") onMessage(data.payload); if (data.type === "error") onState("error"); } catch { onState("error"); } };
  return { send: (text) => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ type: "message.send", payload: { text, clientMessageId: crypto.randomUUID() } })), close: () => socket.close() };
}
