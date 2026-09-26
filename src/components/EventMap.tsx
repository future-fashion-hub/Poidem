import { useEffect } from "react";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Event } from "../api/types";

type EventMapProps = {
  events: Event[];
  onSelect: (event: Event) => void;
};

function markerIcon(event: Event) {
  const fallback = event.title.slice(0, 1).toUpperCase();
  const image = event.imageUrl
    ? `<img src="${event.imageUrl}" alt="" />`
    : `<span>${fallback}</span>`;

  return divIcon({
    className: "event-map-marker-wrapper",
    html: `<div class="event-map-pin"><div class="event-map-pin-image">${image}</div></div>`,
    iconSize: [68, 68],
    iconAnchor: [34, 66],
    tooltipAnchor: [0, -62],
  });
}

function formatTime(value: string) {
  const match = value.match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? "Время уточняется";
}

function RemoveLeafletAttribution() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl.setPrefix(false);
  }, [map]);
  return null;
}

export default function EventMap({ events, onSelect }: EventMapProps) {
  return <div className="event-map overflow-hidden rounded-[28px] border border-white/70 bg-[#dce9d6] shadow-[0_22px_50px_rgba(35,65,42,.18)]">
    <MapContainer
      center={[57.3, 50]}
      zoom={3}
      minZoom={3}
      maxZoom={18}
      scrollWheelZoom
      className="h-[380px] w-full sm:h-[440px]"
      aria-label="Карта мероприятий"
    >
      <RemoveLeafletAttribution />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {events.filter((event) => event.location !== null).map((event) => {
        const position: [number, number] = [event.location!.latitude, event.location!.longitude];
        return <Marker
          key={event.id}
          position={position}
          icon={markerIcon(event)}
          title={event.title}
          eventHandlers={{ click: () => onSelect(event) }}
        >
          <Tooltip direction="top" offset={[0, -28]} opacity={1} className="event-map-tooltip">
            <b>{event.title}</b><span>{formatTime(event.startsAt)} · {event.locationName}</span>
          </Tooltip>
        </Marker>;
      })}
    </MapContainer>
    <p className="pointer-events-none absolute bottom-4 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-[#102318]/90 px-3 py-1.5 text-center text-[10px] font-bold text-white/90 shadow-lg backdrop-blur">Приближайте карту и выбирайте мероприятие</p>
  </div>;
}
