import { Fragment, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import ForumOutlined from "@mui/icons-material/ForumOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import SendRounded from "@mui/icons-material/SendRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import { api, backendMode } from "../api";
import { backendApi } from "../api/backendApi";
import { collectPages } from "../api/pagination";
import { connectCompanyChat, type ChatConnection, type ChatState } from "../api/companyChatSocket";
import type { Company, CompanyMessage } from "../api/types";

type ConnectionState = ChatState | "demo";
const stateLabel: Record<ConnectionState, string> = {
  connecting: "Подключаемся…", connected: "Чат подключён",
  reconnecting: "Переподключаемся…", disconnected: "Соединение прервано", error: "Не удалось подключиться", demo: "Чат компании",
};
const messageTime = (date: string) => new Date(date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dayLabel = (date: string) => new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export default function ChatsPage({ userId }: { userId: number }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState<Company | null>(null);
  const [messages, setMessages] = useState<CompanyMessage[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileConversation, setMobileConversation] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>(backendMode ? "connecting" : "demo");
  const socket = useRef<ChatConnection | null>(null);
  const conversationId = useRef<number | null>(null);
  const scrollArea = useRef<HTMLDivElement | null>(null);
  const followLatest = useRef(true);
  const visibleCompanies = companies.filter(company => company.name.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru").trim()));
  const text = selected ? drafts[selected.id] ?? "" : "";
  const canSend = !!selected && !sending && (!backendMode || connection === "connected");

  useEffect(() => {
    let alive = true;
    collectPages(options => backendMode ? backendApi.listMyCompanies(options) : api.listMyCompanies()).then(result => {
      if (!alive) return;
      const available = result.items.filter(item => item.status === "active");
      setCompanies(available); setSelected(available[0] ?? null);
    }).catch(caught => { if (alive) setError(caught instanceof Error ? caught.message : "Не удалось загрузить чаты"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (scrollArea.current && followLatest.current) scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
  }, [messages, historyLoading, mobileConversation]);
  useEffect(() => {
    const id = selected?.id ?? null;
    conversationId.current = id;
    setMessages([]); setError(""); followLatest.current = true;
    setConnection(backendMode ? "connecting" : "demo");
    if (id === null) return;
    let alive = true;
    let currentSocket: ChatConnection | null = null;
    let hasConnected = false;
    const mergeMessages = (incoming: CompanyMessage[]) => setMessages(live => {
      const unique = new Map(incoming.map(message => [message.id, message]));
      live.forEach(message => unique.set(message.id, message));
      return [...unique.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });
    setHistoryLoading(true);
    collectPages(options => backendMode ? backendApi.listCompanyMessages(id, options) : api.listCompanyMessages(id)).then(result => {
      if (!alive) return;
      mergeMessages(result.items);
    }).catch(caught => { if (alive) setError(caught instanceof Error ? caught.message : "Не удалось загрузить сообщения"); })
      .finally(() => { if (alive) setHistoryLoading(false); });
    if (backendMode) {
      currentSocket = connectCompanyChat(id, message => {
        if (!alive || message.companyId !== id) return;
        setMessages(items => items.some(item => item.id === message.id) ? items : [...items, message]);
      }, state => { if (alive) { setConnection(state); if (state === "connected") {
        setError("");
        if (hasConnected) void collectPages(options => backendApi.listCompanyMessages(id, options)).then(result => { if (alive) mergeMessages(result.items); }).catch(error => { if (alive) setError(error instanceof Error ? error.message : "Не удалось обновить сообщения"); });
        hasConnected = true;
      } } }, message => { if (alive) setError(message); });
      socket.current = currentSocket;
      if (!currentSocket) { setConnection("error"); setError("Адрес чата не настроен"); }
    }
    return () => { alive = false; currentSocket?.close(); if (socket.current === currentSocket) socket.current = null; };
  }, [selected?.id]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !text.trim() || !canSend) return;
    const id = selected.id;
    const message = text.trim();
    setSending(true); setError("");
    try {
      if (backendMode) {
        if (!socket.current) throw new Error("Соединение с чатом ещё не установлено");
        socket.current.send(message);
      } else {
        const created = await api.sendCompanyMessage(id, message);
        if (conversationId.current === id) setMessages(items => [...items, created]);
      }
      followLatest.current = true;
      setDrafts(previous => ({ ...previous, [id]: previous[id] === text ? "" : previous[id] }));
    } catch (caught) {
      if (conversationId.current === id) setError(caught instanceof Error ? caught.message : "Не удалось отправить сообщение");
    } finally { setSending(false); }
  };

  return <main className="chats-page mx-auto max-w-[1240px] px-5 py-8 lg:px-8">
    <header className="chats-heading"><div><p>От планов — к встрече</p><h1>Мои чаты<span>.</span></h1></div><span className="chats-heading-note"><GroupsOutlined fontSize="small"/>Ваша компания уже здесь</span></header>
    <section className={`chat-workspace ${mobileConversation ? "is-conversation-open" : ""}`}>
      <aside className="chat-sidebar">
        <div className="chat-sidebar-heading"><h2>Компании</h2><span>{loading ? "…" : companies.length}</span></div>
        <label className="chat-search"><SearchOutlined fontSize="small"/><span className="sr-only">Поиск по вашим чатам</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Найти компанию"/></label>
        <nav className="chat-company-list" aria-label="Чаты компаний">
          {loading ? <p className="chat-list-notice" role="status">Загружаем ваши чаты…</p> : visibleCompanies.length ? visibleCompanies.map(company => <button key={company.id} className="chat-company" aria-current={selected?.id === company.id ? "page" : undefined} onClick={() => { setSelected(company); setMobileConversation(true); }}>
            <span className="chat-company-avatar">{company.name.slice(0, 1).toUpperCase()}</span><span className="chat-company-copy"><strong>{company.name}</strong><small>{company.membersCount} участников</small></span><ForumOutlined className="chat-company-icon" fontSize="small"/>
          </button>) : <div className="chat-list-notice"><ForumOutlined/><p>{search ? "По этому запросу чатов нет." : "Присоединитесь к компании, чтобы начать общение."}</p></div>}
        </nav>
        <p className="chat-sidebar-foot">Здесь только компании, в которые вы вступили.</p>
      </aside>
      <div className="chat-conversation">
        {selected ? <>
          <header className="chat-topbar"><button type="button" className="chat-back" aria-label="К списку чатов" onClick={() => setMobileConversation(false)}><ArrowBackRounded/></button><span className="chat-company-avatar">{selected.name.slice(0, 1).toUpperCase()}</span><div className="chat-topbar-title"><h2>{selected.name}</h2><p><span className={`chat-connection-dot ${connection === "connected" || connection === "demo" ? "is-connected" : ""}`}/>{stateLabel[connection]} · {selected.membersCount} участников</p></div></header>
          <div ref={scrollArea} className="chat-messages" onScroll={event => { const area = event.currentTarget; followLatest.current = area.scrollHeight - area.scrollTop - area.clientHeight < 90; }}>
            {historyLoading && <p className="chat-history-loading" role="status">Загружаем переписку…</p>}
            {!historyLoading && !messages.length && <div className="chat-empty"><span className="chat-empty-icon"><ForumOutlined fontSize="large"/></span><h3>Знакомство начинается с «привет»</h3><p>Договоритесь о встрече, задайте вопрос или просто представьтесь своей компании.</p></div>}
            {messages.map((message, index) => {
              const mine = message.author.id === userId;
              const day = dayLabel(message.createdAt);
              return <Fragment key={message.id}>
                {(index === 0 || day !== dayLabel(messages[index - 1].createdAt)) && <div className="chat-day"><span>{day}</span></div>}
                <article className={`chat-message ${mine ? "is-own" : ""}`}><p className="chat-message-author">{mine ? "Вы" : `${message.author.firstName} ${message.author.lastName ?? ""}`}</p><p className="chat-message-text">{message.text}</p><time dateTime={message.createdAt}>{messageTime(message.createdAt)}</time></article>
              </Fragment>;
            })}
          </div>
          {error && <p className="chat-error" role="alert">{error}{backendMode && connection !== "connected" && <button type="button" onClick={() => socket.current?.retry()}>Повторить подключение</button>}</p>}
          <form onSubmit={send} className="chat-composer"><label className="sr-only" htmlFor="company-chat-message">Сообщение компании</label><textarea id="company-chat-message" rows={2} value={text} maxLength={2000} onChange={event => setDrafts(previous => ({ ...previous, [selected.id]: event.target.value }))} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={canSend ? "Напишите своей компании…" : "Напишите сообщение — оно останется здесь до подключения…"}/><button type="submit" disabled={!canSend || !text.trim()} aria-label="Отправить сообщение"><SendRounded/></button><div className="chat-composer-hint"><span>Enter — отправить · Shift + Enter — новая строка</span><span>{text.length}/2000</span></div></form>
        </> : <div className="chat-empty"><span className="chat-empty-icon"><ForumOutlined fontSize="large"/></span><h2>Ваши разговоры — здесь</h2><p>Выберите компанию слева, чтобы открыть переписку.</p></div>}
      </div>
    </section>
    {error && !selected && <p className="chat-error chat-list-error" role="alert">{error}</p>}
  </main>;
}
