import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../api";
import { cityCenter, cityForPoint, type Coordinates } from "../api/cityCoordinates";
import { ApiError, type DictionaryItem, type Event, type EventInput } from "../api/types";
import SiteSelect from "./SiteSelect";
import SiteDatePicker from "./SiteDatePicker";
import { eventMapMarkerIcon } from "./eventMapMarker";

type Props = { cities: DictionaryItem[]; categories: DictionaryItem[]; onClose: () => void; onCreated: (event: Event) => void };
type Field = "title" | "category" | "city" | "starts" | "ends" | "location" | "point" | "cover";
type FieldErrors = Partial<Record<Field, string>>;

function MapView({ center }: { center: Coordinates | null }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (center) map.flyTo([center.latitude, center.longitude], 11, { duration: 0.45 });
  }, [map, center?.latitude, center?.longitude]);
  return null;
}

function PointPicker({ point, title, imageUrl, onPick }: { point: Coordinates | null; title: string; imageUrl: string | null; onPick: (point: Coordinates) => void }) {
  useMapEvents({ click: ({ latlng }) => onPick({ latitude: latlng.lat, longitude: latlng.lng }) });
  const icon = useMemo(() => eventMapMarkerIcon(title || "Место", imageUrl), [title, imageUrl]);
  return point ? <Marker position={[point.latitude, point.longitude]} icon={icon} /> : null;
}

export default function EventCreateModalRedesign({ cities, categories, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(0);
  const [cityId, setCityId] = useState(0);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [point, setPoint] = useState<Coordinates | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => firstField.current?.focus(), []);
  useEffect(() => {
    if (!cover) { setCoverPreviewUrl(null); return; }
    const url = URL.createObjectURL(cover);
    setCoverPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);
  const selectedCity = cities.find((city) => city.id === cityId);
  const changeCity = (id: number) => {
    setCityId(id);
    setMapCenter(cityCenter(cities.find((city) => city.id === id)));
    const matchedPointCity = point ? cityForPoint(point, cities) : null;
    if (matchedPointCity && matchedPointCity.id !== id) setPoint(null);
    setErrors((current) => ({ ...current, city: undefined, point: undefined }));
  };

  const pickPoint = (next: Coordinates) => {
    const matched = cityForPoint(next, cities);
    setPoint(next);
    if (matched) setCityId(matched.id);
    setErrors((current) => ({ ...current, point: undefined, city: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!title.trim()) nextErrors.title = "Укажите название события.";
    if (!categoryId) nextErrors.category = "Выберите категорию.";
    if (!cityId) nextErrors.city = "Выберите город из списка.";
    if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) nextErrors.starts = "Укажите дату и время начала.";
    if (endsAt && (!startsAt || new Date(endsAt) <= new Date(startsAt))) nextErrors.ends = "Окончание должно быть позже начала.";
    if (!locationName.trim()) nextErrors.location = "Укажите название площадки.";
    if (!point) nextErrors.point = "Отметьте место на карте.";
    if (!cover) nextErrors.cover = "Добавьте обложку события.";
    else if (!["image/jpeg", "image/png", "image/webp"].includes(cover.type) || cover.size > 10 * 1024 * 1024) nextErrors.cover = "Выберите JPG, PNG или WebP размером до 10 МБ.";
    setErrors(nextErrors);
    setSubmitError("");
    if (Object.keys(nextErrors).length) {
      document.getElementById(`event-create-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      const imageUrl = (await api.uploadEventCover(cover!)).url;
      const input: EventInput = {
        title: title.trim(), categoryId, cityId,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        locationName: locationName.trim(), address: address.trim() || null,
        description: description.trim() || null,
        location: { ...point!, source: "manual" }, imageUrl,
      };
      onCreated(await api.createEvent(input));
    } catch (caught) {
      setSubmitError(caught instanceof ApiError && caught.code === "VALIDATION_ERROR"
        ? "Проверьте данные события и попробуйте ещё раз."
        : caught instanceof Error ? caught.message : "Не удалось создать событие. Попробуйте ещё раз.");
    } finally { setSaving(false); }
  };

  return <div className="event-create-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="event-create-dialog" role="dialog" aria-modal="true" aria-labelledby="event-create-heading" onSubmit={submit} noValidate>
      <header className="event-create-head">
        <div><p className="event-create-eyebrow">Новое событие</p><h2 id="event-create-heading">Соберёмся вместе<span>.</span></h2><p>Расскажите о плане — после проверки он появится в афише.</p></div>
        <button type="button" className="event-create-close" onClick={onClose} aria-label="Закрыть форму">×</button>
      </header>
      <div className="event-create-content">
        <section className="event-create-section" aria-labelledby="event-create-main-heading">
          <div className="event-create-section-heading"><span>01</span><div><h3 id="event-create-main-heading">О событии</h3><p>Коротко и понятно: что будем делать и когда встречаемся.</p></div></div>
          <div className="event-create-grid">
            <div className="event-create-field event-create-wide"><label htmlFor="event-create-title">Название <em>*</em></label><input ref={firstField} id="event-create-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} placeholder="Например, вечер настольных игр" aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "event-create-title-error" : undefined}/>{errors.title && <small id="event-create-title-error" role="alert">{errors.title}</small>}</div>
            <div className="event-create-field event-create-wide"><label htmlFor="event-create-category">Категория <em>*</em></label><SiteSelect id="event-create-category" value={categoryId} onChange={(value) => { setCategoryId(Number(value)); setErrors((current) => ({ ...current, category: undefined })); }} options={[{ value: 0, label: "Выберите категорию" }, ...categories.map((item) => ({ value: item.id, label: item.name }))]}/>{errors.category && <small role="alert">{errors.category}</small>}</div>
            <div className="event-create-field"><label htmlFor="event-create-starts">Начало <em>*</em></label><SiteDatePicker id="event-create-starts" value={startsAt} onChange={setStartsAt} includeTime min={new Date().toISOString().slice(0, 10)} placeholder="Дата и время" ariaLabel="Дата и время начала" className="event-create-date"/>{errors.starts && <small role="alert">{errors.starts}</small>}</div>
            <div className="event-create-field"><label htmlFor="event-create-ends">Окончание</label><SiteDatePicker id="event-create-ends" value={endsAt} onChange={setEndsAt} includeTime min={startsAt.slice(0, 10) || new Date().toISOString().slice(0, 10)} placeholder="Необязательно" ariaLabel="Дата и время окончания" className="event-create-date"/>{errors.ends && <small role="alert">{errors.ends}</small>}</div>
          </div>
        </section>
        <section className="event-create-section" aria-labelledby="event-create-place-heading">
          <div className="event-create-section-heading"><span>02</span><div><h3 id="event-create-place-heading">Место встречи</h3><p>Выберите город или отметьте точку — данные синхронизируются.</p></div></div>
          <div className="event-create-grid">
            <div className="event-create-field"><label htmlFor="event-create-city">Город <em>*</em></label><SiteSelect id="event-create-city" value={cityId} onChange={(value) => changeCity(Number(value))} options={[{ value: 0, label: "Выберите город" }, ...cities.map((item) => ({ value: item.id, label: item.name }))]}/>{errors.city && <small role="alert">{errors.city}</small>}</div>
            <div className="event-create-field"><label htmlFor="event-create-location">Площадка <em>*</em></label><input id="event-create-location" value={locationName} onChange={(event) => setLocationName(event.target.value)} maxLength={255} placeholder="Парк, кафе или другое место"/>{errors.location && <small role="alert">{errors.location}</small>}</div>
            <div className="event-create-field event-create-wide"><label htmlFor="event-create-address">Адрес</label><input id="event-create-address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={500} placeholder="Улица и дом — если знаете"/></div>
          </div>
          <div className="event-create-map-heading"><div><b>Точка на карте <em>*</em></b><p>{point ? `Метка установлена · ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}` : "Нажмите на карту, чтобы поставить метку."}</p></div>{selectedCity && <span>{selectedCity.name}</span>}</div>
          <div id="event-create-point" className="event-create-map" tabIndex={-1} aria-label="Выбор точки события на карте">
            <MapContainer center={[55.75, 37.61]} zoom={4} minZoom={3} className="h-full w-full" scrollWheelZoom>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
              <MapView center={mapCenter}/><PointPicker point={point} title={title} imageUrl={coverPreviewUrl} onPick={pickPoint}/>
            </MapContainer>
          </div>
          {point && !cityForPoint(point, cities) && <p className="event-create-map-hint">Город не определился автоматически. Проверьте или выберите его вручную.</p>}
          {errors.point && <small className="event-create-error" role="alert">{errors.point}</small>}
        </section>
        <section className="event-create-section" aria-labelledby="event-create-details-heading">
          <div className="event-create-section-heading"><span>03</span><div><h3 id="event-create-details-heading">Детали</h3><p>Несколько слов и обложка помогут людям узнать ваше событие.</p></div></div>
          <div className="event-create-field"><label htmlFor="event-create-description">Описание</label><textarea id="event-create-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={4} placeholder="Что ждёт гостей?"/></div>
          <div className="event-create-field"><label htmlFor="event-create-cover">Обложка <em>*</em></label><div className="event-create-upload"><input id="event-create-cover" className="event-create-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setCover(event.target.files?.[0] ?? null)}/><label htmlFor="event-create-cover" className="event-create-upload-button"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="12" cy="12.5" r="3"/><path d="M8 5l1-2h6l1 2"/></svg>Выбрать фото</label><span className="event-create-upload-name">{cover?.name ?? "Фото не выбрано"}</span></div><p className="event-create-help">JPG, PNG или WebP, до 10 МБ</p>{errors.cover && <small role="alert">{errors.cover}</small>}</div>
        </section>
      </div>
      <footer className="event-create-footer"><p>Событие появится после модерации.</p><div><button type="button" className="event-create-cancel" onClick={onClose}>Отмена</button><button type="submit" className="event-create-submit" disabled={saving}>{saving ? "Отправляем…" : "Отправить на модерацию"}</button></div></footer>
      {submitError && <p className="event-create-submit-error" role="alert">{submitError}</p>}
    </form>
  </div>;
}
