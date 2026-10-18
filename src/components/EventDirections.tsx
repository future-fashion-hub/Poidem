import { useRef, useState } from "react"
import RouteOutlined from "@mui/icons-material/RouteOutlined"
import DirectionsWalkOutlined from "@mui/icons-material/DirectionsWalkOutlined"
import DirectionsTransitOutlined from "@mui/icons-material/DirectionsTransitOutlined"
import DirectionsCarOutlined from "@mui/icons-material/DirectionsCarOutlined"
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded"
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded"
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined"
import CheckRounded from "@mui/icons-material/CheckRounded"
import { directionLinks, routeDestination } from "../api/eventDirections"
import type { TravelMode } from "../api/eventDirections"
import type { Event } from "../api/types"
import "./eventDirections.css"

const modes = [
  { value: "walking", label: "Пешком", icon: DirectionsWalkOutlined },
  { value: "transit", label: "Транспорт", icon: DirectionsTransitOutlined },
  { value: "driving", label: "На машине", icon: DirectionsCarOutlined },
] as const

type Props = {
  event: Event
  cityName?: string
}

export default function EventDirections({ event, cityName }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<TravelMode>("walking")
  const [copyState, setCopyState] =
    useState<"idle" | "copying" | "copied" | "error">("idle")
  const trigger = useRef<HTMLButtonElement | null>(null)
  const copying = useRef(false)
  const destination = routeDestination(event, cityName)
  const panelId = `event-directions-${event.id}`
  const copy = async () => {
    if (!destination || copying.current) return
    copying.current = true
    setCopyState("copying")
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable")
      await navigator.clipboard.writeText(
        destination.exact
          ? `${destination.label}\n${destination.value}`
          : destination.label,
      )
      setCopyState("copied")
    } catch {
      setCopyState("error")
    } finally {
      copying.current = false
    }
  }
  if (!destination)
    return (
      <p className="event-directions-unavailable">
        Маршрут появится, когда организатор укажет место встречи и город или
        точку на карте.
      </p>
    )
  return (
    <section
      className="event-directions"
      aria-label="Маршрут до места встречи"
      onKeyDown={(key) => {
        if (key.key === "Escape" && open) {
          key.preventDefault()
          key.stopPropagation()
          setOpen(false)
          trigger.current?.focus({ preventScroll: true })
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="event-directions-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="event-directions-icon">
          <RouteOutlined aria-hidden="true" />
        </span>
        <span className="event-directions-trigger-copy">
          <strong>Как добраться</strong>
          <small>
            {event.address?.trim() || "Построить маршрут до места встречи"}
          </small>
        </span>
        <ExpandMoreRounded
          className="event-directions-chevron"
          aria-hidden="true"
        />
      </button>
      {open && (
        <div id={panelId} className="event-directions-panel">
          <p className="event-directions-address">{destination.label}</p>
          {!destination.exact && (
            <p className="event-directions-note">
              Точная метка не указана. Карты найдут место по адресу или названию
              — проверьте найденную точку.
            </p>
          )}
          <fieldset className="event-directions-modes">
            <legend>Способ передвижения</legend>
            <div>
              {modes.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  aria-pressed={mode === item.value}
                  onClick={() => setMode(item.value)}
                >
                  <item.icon aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <nav
            className="event-directions-providers"
            aria-label="Выберите карты для маршрута"
          >
            {directionLinks(destination, mode).map((link) => (
              <a
                key={link.id}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${link.label} — маршрут, откроется в приложении или новой вкладке`}
              >
                <span>{link.label}</span>
                <ArrowOutwardRounded aria-hidden="true" />
              </a>
            ))}
          </nav>
          <div className="event-directions-footer">
            <p className="event-directions-note">
              Начальную точку и время в пути подскажут выбранные карты.
            </p>
            <button
              type="button"
              className="event-directions-copy"
              disabled={copyState === "copying"}
              onClick={() => void copy()}
            >
              {copyState === "copied" ? (
                <CheckRounded aria-hidden="true" />
              ) : (
                <ContentCopyOutlined aria-hidden="true" />
              )}
              {copyState === "copying"
                ? "Копируем…"
                : copyState === "copied"
                  ? "Скопировано"
                  : "Скопировать место"}
            </button>
          </div>
          {copyState === "copied" && (
            <p className="sr-only" role="status">
              Место встречи скопировано.
            </p>
          )}
          {copyState === "error" && (
            <p className="event-directions-note" role="alert">
              Не удалось скопировать. Выделите адрес выше и скопируйте его
              вручную.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
