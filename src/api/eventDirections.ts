import type { Event } from "./types"
import { eventPosition } from "./eventPosition"

export type TravelMode = "walking" | "transit" | "driving"
export type RouteDestination = {
  value: string
  label: string
  exact: boolean
}
type RouteEvent = Pick<Event, "location" | "locationName" | "address">

export function routeDestination(
  event: RouteEvent,
  cityName?: string,
): RouteDestination | null {
  const position = eventPosition(event)
  const city = cityName?.trim() ?? "",
    address = event.address?.trim() ?? "",
    venue = event.locationName?.trim() ?? ""
  const label = [...new Set([city, venue, address].filter(Boolean))].join(", ")
  if (position)
    return {
      value: position.join(","),
      label: label || position.join(", "),
      exact: true,
    }
  // Never substitute the city centre for the actual meeting point.
  if (!city || (!address && !venue)) return null
  return { value: `${city}, ${address || venue}`, label, exact: false }
}

export function directionLinks(
  destination: RouteDestination,
  mode: TravelMode,
) {
  const yandex = new URL("https://yandex.ru/maps/")
  yandex.searchParams.set("rtext", `~${destination.value}`)
  yandex.searchParams.set(
    "rtt",
    { walking: "pd", transit: "mt", driving: "auto" }[mode],
  )
  const google = new URL("https://www.google.com/maps/dir/")
  google.searchParams.set("api", "1")
  google.searchParams.set("destination", destination.value)
  google.searchParams.set("travelmode", mode)
  const apple = new URL("https://maps.apple.com/directions")
  apple.searchParams.set("destination", destination.value)
  apple.searchParams.set("mode", mode)
  return [
    { id: "yandex", label: "Яндекс Карты", href: yandex.href },
    { id: "google", label: "Google Карты", href: google.href },
    { id: "apple", label: "Apple Карты", href: apple.href },
  ]
}

// Provider URL formats: https://yandex.com/dev/yandex-apps-launch-maps/doc/en/concepts/yandexmaps-web
// https://developers.google.com/maps/documentation/urls/get-started
// https://developer.apple.com/documentation/mapkit/unified-map-urls
