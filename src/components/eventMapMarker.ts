import { divIcon } from "leaflet";

export function eventMapMarkerIcon(title: string, imageUrl?: string | null) {
  const pin = document.createElement("div");
  pin.className = "event-map-pin";
  const cover = document.createElement("div");
  cover.className = "event-map-pin-image";
  const fallback = () => { cover.textContent = title.trim().slice(0, 1).toUpperCase() || "•"; };

  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = title;
    image.width = 32;
    image.height = 32;
    image.addEventListener("error", fallback, { once: true });
    cover.append(image);
  } else {
    fallback();
  }
  pin.append(cover);

  return divIcon({
    className: "event-map-marker-wrapper",
    html: pin,
    iconSize: [68, 68],
    iconAnchor: [34, 66],
    tooltipAnchor: [0, -62],
  });
}
