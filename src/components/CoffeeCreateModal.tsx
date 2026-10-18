import { useEffect, useRef, useState, type FormEvent } from "react";
import AddRounded from "@mui/icons-material/AddRounded";
import { api } from "../api";
import { coffeeTopics, validateCoffee } from "../api/coffee";
import type { CoffeeInput, CoffeeMeeting } from "../api/coffeeTypes";
import type { DictionaryItem } from "../api/types";
import SiteSelect from "./SiteSelect";
import SiteDatePicker from "./SiteDatePicker";
import CoffeeDialog from "./CoffeeDialog";

type Props = { cities: DictionaryItem[]; cityId: number; onClose: () => void; onCreated: (meeting: CoffeeMeeting) => void };
export default function CoffeeCreateModal({ cities, cityId, onClose, onCreated }: Props) {
  const initial = useRef<CoffeeInput>({ title: "", description: "", cityId, locationName: "", address: "", startsAt: "", duration: 60, maxMembers: 4, joinType: "open", topic: "chat" });
  const [draft, setDraft] = useState(initial.current);
  const [errors, setErrors] = useState<Partial<Record<keyof CoffeeInput, string>>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false), summary = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial.current);
  useEffect(() => { if (error || Object.values(errors).some(Boolean)) summary.current?.focus(); }, [error, errors]);
  const update = <K extends keyof CoffeeInput>(key: K, value: CoffeeInput[K]) => {
    setDraft(previous => ({ ...previous, [key]: value }));
    setErrors(previous => ({ ...previous, [key]: undefined }));
    setError("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving.current) return;
    const nextErrors = validateCoffee(draft, cities.map(city => city.id));
    setErrors(nextErrors); setError("");
    if (Object.keys(nextErrors).length) return;
    saving.current = true; setBusy(true);
    try {
      const meeting = await api.createCoffeeMeeting({ ...draft, startsAt: new Date(draft.startsAt).toISOString() });
      onCreated(meeting);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось создать встречу. Попробуйте ещё раз."); }
    finally { saving.current = false; setBusy(false); }
  };
  const fieldError = (field: keyof CoffeeInput) => errors[field] ? <small id={`coffee-error-${field}`} className="coffee-field-error">{errors[field]}</small> : null;
  return <CoffeeDialog title="Позовём на кофе?" busy={busy} dirty={dirty} onClose={onClose}>{dismiss => <form className="coffee-form" onSubmit={submit} noValidate aria-busy={busy}>
    <p className="coffee-form-intro">Выберите любимое место и оставьте пару слов о себе. За столиком будет от 2 до 8 человек, включая вас.</p>
    {(error || Object.values(errors).some(Boolean)) && <div ref={summary} className="coffee-feedback coffee-feedback--error" role="alert" tabIndex={-1}>{error || "Проверьте поля:"}{!error && <ul>{Object.entries(errors).filter(([, message]) => message).map(([field, message]) => <li key={field}><a href={`#coffee-${field}`} onClick={event => { event.preventDefault(); document.getElementById(`coffee-${field}`)?.focus(); }}>{message}</a></li>)}</ul>}</div>}
    <fieldset disabled={busy} className="coffee-form-fields">
      <div className="coffee-form-field coffee-full"><label htmlFor="coffee-title">Как назовём встречу?</label><input id="coffee-title" value={draft.title} maxLength={90} placeholder="Например, капучино и разговоры о кино" onChange={event => update("title", event.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "coffee-error-title" : undefined}/>{fieldError("title")}</div>
      <fieldset className="coffee-full coffee-topic-field"><legend>Какое настроение?</legend><div className="coffee-topic-options">{coffeeTopics.map(topic => <label key={topic.value}><input type="radio" name="coffee-topic" value={topic.value} checked={draft.topic === topic.value} onChange={() => update("topic", topic.value)}/><span><b>{topic.label}</b><small>{topic.description}</small></span></label>)}</div>{fieldError("topic")}</fieldset>
      <div className="coffee-form-field"><label htmlFor="coffee-cityId">Город</label><SiteSelect id="coffee-cityId" value={draft.cityId} onChange={value => update("cityId", Number(value))} options={[{ value: 0, label: "Выберите город" }, ...cities.map(city => ({ value: city.id, label: city.name }))]}/>{fieldError("cityId")}</div>
      <div className="coffee-form-field"><label htmlFor="coffee-locationName">Кофейня или место встречи</label><input id="coffee-locationName" value={draft.locationName} maxLength={160} placeholder="Название места" onChange={event => update("locationName", event.target.value)} aria-invalid={Boolean(errors.locationName)} aria-describedby={errors.locationName ? "coffee-error-locationName" : undefined}/>{fieldError("locationName")}</div>
      <div className="coffee-form-field coffee-full"><label htmlFor="coffee-address">Адрес <span>необязательно</span></label><input id="coffee-address" value={draft.address} maxLength={240} placeholder="Улица, дом или точка, где встретимся" onChange={event => update("address", event.target.value)}/>{fieldError("address")}</div>
      <div className="coffee-form-field"><label htmlFor="coffee-startsAt">Когда встречаемся?</label><SiteDatePicker id="coffee-startsAt" includeTime value={draft.startsAt} onChange={value => update("startsAt", value)} min={new Date().toLocaleDateString("sv-SE")} ariaLabel="Дата и время встречи"/>{fieldError("startsAt")}</div>
      <div className="coffee-form-field"><label htmlFor="coffee-duration">Сколько времени?</label><SiteSelect id="coffee-duration" value={draft.duration} onChange={value => update("duration", Number(value))} options={[{ value: 30, label: "Полчаса" }, { value: 60, label: "Один час" }, { value: 90, label: "Полтора часа" }, { value: 120, label: "Два часа" }]}/>{fieldError("duration")}</div>
      <div className="coffee-form-field"><label htmlFor="coffee-maxMembers">Людей за столом, включая вас</label><SiteSelect id="coffee-maxMembers" value={draft.maxMembers} onChange={value => update("maxMembers", Number(value))} options={Array.from({ length: 7 }, (_, index) => ({ value: index + 2, label: `${index + 2}` }))}/>{fieldError("maxMembers")}</div>
      <div className="coffee-form-field"><label htmlFor="coffee-joinType">Как присоединиться?</label><SiteSelect id="coffee-joinType" value={draft.joinType} onChange={value => update("joinType", value as CoffeeInput["joinType"])} options={[{ value: "open", label: "Свободно, пока есть места" }, { value: "request", label: "По заявке организатору" }]}/>{fieldError("joinType")}</div>
      <div className="coffee-form-field coffee-full"><label htmlFor="coffee-description">О чём хочется поговорить?</label><textarea id="coffee-description" rows={4} maxLength={1200} value={draft.description} placeholder="Расскажите о встрече и с какой компанией хотите провести время" onChange={event => update("description", event.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "coffee-error-description" : undefined}/>{fieldError("description")}</div>
    </fieldset>
    <p className="coffee-form-note">Участие бесплатное. Напитки каждый оплачивает самостоятельно. Встреча появится в ваших планах вместе с компанией и чатом.</p>
    <footer className="coffee-form-footer"><button type="button" className="coffee-button coffee-button--secondary" disabled={busy} onClick={dismiss}>Отмена</button><button type="submit" className="coffee-button coffee-button--primary" disabled={busy}><AddRounded aria-hidden="true"/>{busy ? "Создаём встречу…" : "Создать встречу"}</button></footer>
  </form>}</CoffeeDialog>;
}
