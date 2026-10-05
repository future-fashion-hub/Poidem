import { useEffect, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Event } from "../api/types";
import { eventPosition } from "../api/eventPosition";
import { eventMapMarkerIcon } from "./eventMapMarker";

type EventMapProps = {
  events: Event[];
  onSelect: (event: Event) => void;
};

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

function FitEventMarkers({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const coordinates = JSON.stringify(positions);
  useEffect(() => {
    const points = JSON.parse(coordinates) as [number, number][];
    map.invalidateSize();
    if (points.length) map.fitBounds(points, { padding: [55, 75], maxZoom: 13, animate: false });
  }, [map, coordinates]);
  return null;
}

export default function EventMap({ events, onSelect }: EventMapProps) {
  const markers = useMemo(() => events.flatMap(event => {
    const position = eventPosition(event);
    return position ? [{ event, position }] : [];
  }), [events]);
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
      <FitEventMarkers positions={markers.map(marker => marker.position)} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map(({ event, position }) => {
        return <Marker
          key={event.id}
          position={position}
          icon={eventMapMarkerIcon(event.title, event.imageUrl)}
          title={event.title}
          eventHandlers={{ click: () => onSelect(event) }}
        >
          <Tooltip direction="top" offset={[0, -28]} opacity={1} className="event-map-tooltip">
            <b>{event.title}</b><span>{formatTime(event.startsAt)} · {event.locationName}</span>
          </Tooltip>
        </Marker>;
      })}
    </MapContainer>
  </div>;
}
