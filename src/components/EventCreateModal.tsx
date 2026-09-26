import { useState } from "react";
import { api } from "../api";
import { ApiError, type DictionaryItem, type Event, type EventInput } from "../api/types";

type Props = { cities: DictionaryItem[]; categories: DictionaryItem[]; onClose: () => void; onCreated: (event: Event) => void };

export default function EventCreateModal({ cities, categories, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(0);
  const [cityId, setCityId] = useState(0);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const hasCoordinates = latitude.trim() || longitude.trim();
    if (!title.trim() || !categoryId || !cityId || !startsAt || !locationName.trim()) return setError("Заполните название, категорию, город, дату и место.");
    if (hasCoordinates && (!latitude.trim() || !longitude.trim() || Number(latitude) < -90 || Number(latitude) > 90 || Number(longitude) < -180 || Number(longitude) > 180)) return setError("Укажите корректные координаты или оставьте оба поля пустыми.");
    setSaving(true);
    try {
      const imageUrl = cover ? (await api.uploadEventCover(cover)).url : null;
      const input: EventInput = { title: title.trim(), categoryId, cityId, startsAt: new Date(startsAt).toISOString(), endsAt: endsAt ? new Date(endsAt).toISOString() : null, locationName: locationName.trim(), address: address.trim() || null, description: description.trim() || null, location: hasCoordinates ? { latitude: Number(latitude), longitude: Number(longitude), source: "manual" } : null, imageUrl };
      if (input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) return setError("Время окончания должно быть позже начала.");
      onCreated(await api.createEvent(input));
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "VALIDATION_ERROR") setError("Проверьте заполнение полей мероприятия.");
      else setError(caught instanceof Error ? caught.message : "Не удалось создать мероприятие.");
    } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[2100] grid place-items-center overflow-y-auto bg-[#08130d]/55 p-5 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form onSubmit={submit} className="my-auto w-full max-w-2xl rounded-[30px] bg-white p-6 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#69826e]">Новое мероприятие</p><h2 className="mt-2 text-2xl font-black">Расскажите о событии</h2><p className="mt-2 text-sm text-[#718075]">После создания событие попадёт на модерацию и не появится в публичном каталоге до одобрения.</p></div><button type="button" onClick={onClose} aria-label="Закрыть" className="grid h-10 w-10 place-items-center rounded-xl bg-[#eff4ec] text-lg">×</button></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2 text-sm font-bold">Название<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2.5 font-normal" /></label><label className="text-sm font-bold">Категория<select value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2.5 font-normal"><option value={0}>Выберите категорию</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-bold">Город<select value={cityId} onChange={(event) => setCityId(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2.5 font-normal"><option value={0}>Выберите город</option>{cities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-bold">Начало<input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2.5 font-normal" /></label><label className="text-sm font-bold">Окончание<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2.5 font-normal" /></label><label className="text-sm font-bold">Площадка<input value={locationName} onChange={(event) => setLocationName(event.target.value)} maxLength={255} className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2.5 font-normal" /></label><label className="text-sm font-bold">Адрес<input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={500} className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2.5 font-normal" /></label><label className="text-sm font-bold">Широта (необязательно)<input value={latitude} onChange={(event) => setLatitude(event.target.value)} inputMode="decimal" placeholder="55.7558" className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2.5 font-normal" /></label><label className="text-sm font-bold">Долгота (необязательно)<input value={longitude} onChange={(event) => setLongitude(event.target.value)} inputMode="decimal" placeholder="37.6173" className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2.5 font-normal" /></label><label className="sm:col-span-2 text-sm font-bold">Описание<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={3} className="mt-2 w-full rounded-xl border border-[#dce5da] px-3 py-2.5 font-normal" /></label><label className="sm:col-span-2 text-sm font-bold">Обложка (JPG, PNG или WebP, до 10 МБ)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setCover(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-xs font-normal" /></label></div>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-[#fff0ed] px-4 py-3 text-sm font-semibold text-[#9e3128]">{error}</p> : null}<button disabled={saving} className="mt-6 w-full rounded-xl bg-[#102318] py-3.5 text-sm font-extrabold text-[#bdf238] disabled:opacity-50">{saving ? "Создаём…" : "Отправить на модерацию"}</button>
    </form>
  </div>;
}
