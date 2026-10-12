import { backendMode, getChatAccessToken, refreshChatAccessToken } from "./backendApi";
import type { CompanyMessage } from "./types";

export type ChatState = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";
export type ChatConnection = { send: (text: string) => void; close: () => void; retry: () => void };
type SocketEvent = { type: "message.created"; payload: CompanyMessage } | { type: "error"; payload: { code?: string; message?: string } };

function chatBaseUrl() {
  const explicit = import.meta.env.VITE_CHAT_WS_URL as string | undefined;
  if (explicit) return explicit.replace(/\/$/, "");
  const apiBase = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "");
  return apiBase ? `${apiBase.replace(/^http/, "ws")}/api/v1/ws` : "";
}

export function connectCompanyChat(companyId: number, onMessage: (message: CompanyMessage) => void, onState: (state: ChatState) => void, onError: (message: string) => void): ChatConnection | null {
  const base = chatBaseUrl();
  if (!backendMode || !base) return null;
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let attempt = 0;
  let generation = 0;
  const schedule = () => {
    if (closed || timer) return;
    onState("reconnecting");
    const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5));
    timer = setTimeout(() => { timer = null; void connect(); }, delay);
  };
  const connect = async () => {
    const current = ++generation;
    onState(attempt ? "reconnecting" : "connecting");
    try {
      const token = attempt ? await refreshChatAccessToken() : await getChatAccessToken();
      if (closed || current !== generation) return;
      const url = new URL(`${base}/companies/${companyId}`);
      url.searchParams.set("access_token", token);
      const next = new WebSocket(url);
      socket = next;
      next.onopen = () => { if (!closed && current === generation) { attempt = 0; onState("connected"); } };
      next.onmessage = event => {
        if (closed || current !== generation) return;
        try {
          const data = JSON.parse(event.data) as SocketEvent;
          if (data.type === "message.created") onMessage(data.payload);
          if (data.type === "error") onError(data.payload?.message || data.payload?.code || "Ошибка чата");
        } catch { onError("Сервер прислал некорректное сообщение чата"); }
      };
      next.onerror = () => { if (!closed && current === generation) onError("Не удалось установить соединение с чатом"); };
      next.onclose = event => {
        if (closed || current !== generation) return;
        if (event.reason) onError(event.reason);
        onState("disconnected");
        schedule();
      };
    } catch (error) {
      if (closed || current !== generation) return;
      onError(error instanceof Error ? error.message : "Не удалось обновить доступ к чату");
      schedule();
    }
  };
  void connect();
  return {
    send(text) {
      if (socket?.readyState !== WebSocket.OPEN) throw new Error("Соединение прервано. Подождите переподключения и отправьте сообщение снова.");
      socket.send(JSON.stringify({ type: "message.send", payload: { text, clientMessageId: crypto.randomUUID() } }));
    },
    retry() { if (closed) return; if (timer) clearTimeout(timer); timer = null; attempt = 1; socket?.close(); void connect(); },
    close() { closed = true; generation++; if (timer) clearTimeout(timer); socket?.close(); onState("disconnected"); },
  };
}
