import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import NotificationsNoneOutlined from "@mui/icons-material/NotificationsNoneOutlined"
import CloseRounded from "@mui/icons-material/CloseRounded"
import DoneAllRounded from "@mui/icons-material/DoneAllRounded"
import CheckRounded from "@mui/icons-material/CheckRounded"
import GroupsOutlined from "@mui/icons-material/GroupsOutlined"
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined"
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined"
import { api, backendMode } from "../api"
import { ApiError } from "../api/types"
import { collectPages } from "../api/pagination"
import type {
  SiteNotification,
  NotificationTarget,
} from "../api/notificationTypes"
import { useModalDialog } from "./useModalDialog"
import { usePopupDismiss } from "./usePopupDismiss"
import "./notifications.css"

type Props = {
  userId: number
  revision: number
  onOpenChange: (open: boolean) => void
  onAction: (target: NotificationTarget) => void
}
const icons = {
  application: GroupsOutlined,
  company: GroupsOutlined,
  reminder: ScheduleOutlined,
  event: CalendarMonthOutlined,
}
export default function NotificationsCenter({
  userId,
  revision,
  onOpenChange,
  onAction,
}: Props) {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<SiteNotification[]>([])
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false),
    [leaving, setLeaving] = useState(false)
  const generation = useRef(0),
    alive = useRef(true),
    writing = useRef(false),
    nextTarget = useRef<NotificationTarget | null>(null)
  const panel = useRef<HTMLElement>(null)
  const unread = items.filter((item) => !item.readAt).length
  const visible = unreadOnly ? items.filter((item) => !item.readAt) : items
  const close = () => {
    setOpen(false)
    setLeaving(false)
    const target = nextTarget.current
    nextTarget.current = null
    if (target) onAction(target)
  }
  const { closing, dismiss } = usePopupDismiss(close, open, { busy })
  useModalDialog(panel, dismiss, open)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      generation.current++
    }
  }, [])
  useEffect(() => {
    onOpenChange(open)
    return () => onOpenChange(false)
  }, [open, onOpenChange])
  useEffect(() => {
    if (leaving && !busy) dismiss()
  }, [leaving, busy, dismiss])
  const load = useCallback(async () => {
    if (writing.current) return
    const request = ++generation.current
    setLoading(true)
    try {
      const result = await collectPages(
        (options) => api.listNotifications(options),
        50,
        true,
      )
      if (alive.current && request === generation.current) {
        setItems(result.items)
        setError("")
      }
    } catch (caught) {
      if (alive.current && request === generation.current)
        setError(
          backendMode && caught instanceof ApiError && caught.status === 404
            ? "API уведомлений ещё не подключено к серверу."
            : caught instanceof Error
              ? caught.message
              : "Не удалось загрузить уведомления.",
        )
    } finally {
      if (alive.current && request === generation.current) setLoading(false)
    }
  }, [userId])
  useEffect(() => {
    void load()
    const refresh = () => {
      if (document.visibilityState !== "hidden") void load()
    }
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      generation.current++
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [load, revision])
  const mark = async (
    selected: SiteNotification[],
    target?: NotificationTarget,
  ) => {
    if (writing.current) return
    writing.current = true
    generation.current++
    setBusy(true)
    setError("")
    const ids = selected.filter((item) => !item.readAt).map((item) => item.id)
    try {
      for (let start = 0; start < ids.length; start += 200) {
        const batch = ids.slice(start, start + 200)
        await api.markNotificationsRead(batch)
        if (!alive.current) return
        const confirmed = new Set(batch),
          readAt = new Date().toISOString()
        setItems((previous) =>
          previous.map((item) =>
            confirmed.has(item.id) ? { ...item, readAt } : item,
          ),
        )
      }
      if (!alive.current) return
      if (target) {
        nextTarget.current = target
        setLeaving(true)
      }
    } catch (caught) {
      if (alive.current)
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось отметить уведомления.",
        )
    } finally {
      writing.current = false
      if (alive.current) {
        setBusy(false)
        setLoading(false)
      }
    }
  }
  return (
    <>
      <button
        type="button"
        className="notifications-trigger"
        aria-label={
          unread ? `Уведомления, непрочитанных: ${unread}` : "Уведомления"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          nextTarget.current = null
          setLeaving(false)
          setOpen(true)
          void load()
        }}
      >
        <NotificationsNoneOutlined aria-hidden="true" />
        {unread > 0 && (
          <span aria-hidden="true">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>
      {!open && (
        <span className="sr-only" role="status" aria-atomic="true">
          {loading && !items.length
            ? "Проверяем уведомления"
            : `Непрочитанных уведомлений: ${unread}`}
        </span>
      )}
      {open &&
        createPortal(
          <div
            className="notifications-overlay"
            data-closing={closing || undefined}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) dismiss()
            }}
          >
            <section
              className="notifications-panel"
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby="notifications-title"
              tabIndex={-1}
            >
              <header className="notifications-heading">
                <span className="notifications-heading-icon">
                  <NotificationsNoneOutlined aria-hidden="true" />
                </span>
                <div>
                  <p>Ваши планы на связи</p>
                  <h2 id="notifications-title">
                    Уведомления<span>.</span>
                  </h2>
                </div>
                <button
                  type="button"
                  className="notifications-icon-button"
                  aria-label="Закрыть уведомления"
                  disabled={busy}
                  onClick={dismiss}
                >
                  <CloseRounded aria-hidden="true" />
                </button>
              </header>
              <p
                className="sr-only"
                role="status"
                aria-atomic="true"
              >{`Непрочитанных уведомлений: ${unread}`}</p>
              <div className="notifications-tools">
                <div className="notifications-tabs">
                  <button
                    type="button"
                    aria-pressed={!unreadOnly}
                    onClick={() => setUnreadOnly(false)}
                  >
                    Все
                  </button>
                  <button
                    type="button"
                    aria-pressed={unreadOnly}
                    onClick={() => setUnreadOnly(true)}
                  >
                    Непрочитанные <span>{unread}</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="notifications-read-all"
                  disabled={!unread || loading || busy}
                  onClick={() => {
                    void mark(items)
                  }}
                >
                  <DoneAllRounded aria-hidden="true" />
                  Прочитать все
                </button>
              </div>
              {error && (
                <div className="notifications-error" role="alert">
                  <p>{error}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void load()
                    }}
                  >
                    Попробовать снова
                  </button>
                </div>
              )}
              <div className="notifications-list">
                {loading && !items.length ? (
                  <p className="notifications-loading" role="status">
                    Загружаем уведомления…
                  </p>
                ) : visible.length ? (
                  <ol>
                    {visible.map((item) => {
                      const NotificationIcon =
                        icons[item.kind] ?? NotificationsNoneOutlined
                      return (
                        <li
                          key={item.id}
                          className="notifications-item"
                          data-unread={!item.readAt || undefined}
                        >
                          <span className="notifications-item-icon">
                            <NotificationIcon aria-hidden="true" />
                          </span>
                          <div className="notifications-item-copy">
                            <div>
                              <h3>{item.title}</h3>
                              {!item.readAt && (
                                <span className="notifications-new">Новое</span>
                              )}
                            </div>
                            <p>{item.body}</p>
                            <time dateTime={item.createdAt}>
                              {new Date(item.createdAt).toLocaleString(
                                "ru-RU",
                                {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </time>
                            <div className="notifications-item-actions">
                              <button
                                type="button"
                                disabled={busy || loading}
                                onClick={() => {
                                  void mark([item], item.target)
                                }}
                              >
                                {item.target.kind === "event"
                                  ? "Открыть событие"
                                  : item.target.kind === "chat"
                                    ? "Перейти в чат"
                                    : item.target.kind === "company"
                                      ? "Открыть компанию"
                                      : "Мои планы"}
                              </button>
                              {!item.readAt && (
                                <button
                                  type="button"
                                  className="notifications-mark-one"
                                  disabled={busy || loading}
                                  onClick={() => {
                                    void mark([item])
                                  }}
                                >
                                  <CheckRounded aria-hidden="true" />
                                  Прочитано
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                ) : !error ? (
                  <div className="notifications-empty">
                    <span>
                      <NotificationsNoneOutlined aria-hidden="true" />
                    </span>
                    <h3>{unreadOnly ? "Всё прочитано" : "Пока тихо"}</h3>
                    <p>
                      {unreadOnly
                        ? "Новых уведомлений нет. Все сообщения остаются во вкладке «Все»."
                        : "Здесь появятся решения по заявкам, новости ваших компаний и напоминания о встречах."}
                    </p>
                  </div>
                ) : null}
              </div>
              <footer>
                Уведомления внутри сайта. История хранится за последние 30 дней.
              </footer>
            </section>
          </div>,
          document.body,
        )}
    </>
  )
}
