export type NotificationTarget = {
  kind: "event" | "company" | "chat" | "plans"
  id?: number
  tab?: "events" | "applications"
}
export type SiteNotification = {
  id: string
  kind: "application" | "company" | "event" | "reminder"
  title: string
  body: string
  createdAt: string
  readAt: string | null
  target: NotificationTarget
}
