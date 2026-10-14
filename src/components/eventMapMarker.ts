import { divIcon } from "leaflet";

export function eventMapMarkerIcon(title: string, imageUrl?: string | null, hollow = false) {
  const pin = document.createElement("div");
  pin.className = hollow ? "event-map-pin event-map-pin--hollow" : "event-map-pin";
  const cover = document.createElement("div");
  cover.className = "event-map-pin-image";
  const fallback = () => { cover.textContent = title.trim().slice(0, 1).toUpperCase() || "•"; };

  if (imageUrl && !hollow) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = title;
    image.width = 32;
    image.height = 32;
    image.addEventListener("error", fallback, { once: true });
    cover.append(image);
  } else if (!hollow) {
    fallback();
  }
  if (!hollow) pin.append(cover);

  return divIcon({
    className: "event-map-marker-wrapper",
    html: pin,
    iconSize: [68, 68],
    iconAnchor: [34, 66],
    tooltipAnchor: [0, -62],
  });
}
