import { DayPicker } from "@daypicker/react";
import { ru } from "@daypicker/react/locale";
import "@daypicker/react/style.css";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import SiteSelect from "./SiteSelect";
import { pickerTime } from "./dateTimeValue";

type Props = {
  value: string;
  onChange: (value: string) => void;
  includeTime?: boolean;
  max?: string;
  min?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  id?: string;
};

const parseDay = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const dayValue = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
const hours = Array.from({ length: 24 }, (_, value) => ({ value: String(value).padStart(2, "0"), label: String(value).padStart(2, "0") }));
const minutes = Array.from({ length: 60 }, (_, value) => ({ value: String(value).padStart(2, "0"), label: String(value).padStart(2, "0") }));

export default function SiteDatePicker({ value, onChange, includeTime = false, max, min, placeholder = "Выберите дату", ariaLabel = "Выбрать дату", className = "", id: externalId }: Props) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const root = useRef<HTMLDivElement>(null);
  const selected = parseDay(value);
  const minDate = parseDay(min ?? "");
  const maxDate = parseDay(max ?? "");
  const initialMonth = selected ?? maxDate ?? minDate ?? new Date();
  const [month, setMonth] = useState(initialMonth);
  const [open, setOpen] = useState(false);
  const [draftTime, setDraftTime] = useState("12:00");
  const time = value.includes("T") ? pickerTime(value) : draftTime;
  const firstYear = minDate?.getFullYear() ?? (includeTime ? new Date().getFullYear() - 1 : 1920);
  const lastYear = maxDate?.getFullYear() ?? (includeTime ? new Date().getFullYear() + 5 : new Date().getFullYear());
  const years = useMemo(() => Array.from({ length: Math.max(1, lastYear - firstYear + 1) }, (_, index) => firstYear + index), [firstYear, lastYear]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, index) => ({ value: index, label: new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(new Date(2024, index, 1)) })), []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (selected) setMonth(selected);
  }, [value]);

  const setCalendarMonth = (nextMonth?: number, nextYear?: number) => {
    setMonth(new Date(nextYear ?? month.getFullYear(), nextMonth ?? month.getMonth(), 1));
  };

  const chooseDay = (date?: Date) => {
    if (!date) return;
    onChange(`${dayValue(date)}${includeTime ? `T${time}` : ""}`);
  };
  const chooseTime = (nextTime: string) => {
    setDraftTime(nextTime);
    if (selected) onChange(`${dayValue(selected)}T${nextTime}`);
  };

  const labelOptions: Intl.DateTimeFormatOptions = includeTime
    ? { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "long", year: "numeric" };
  const label = selected
    ? new Intl.DateTimeFormat("ru-RU", labelOptions).format(includeTime ? new Date(`${dayValue(selected)}T${time}`) : selected)
    : placeholder;

  return <div ref={root} className={`site-date ${open ? "is-open" : ""} ${className}`}>
    <button id={id} type="button" className="site-date-trigger" aria-label={ariaLabel} aria-expanded={open} aria-controls={`${id}-calendar`} onClick={() => setOpen(true)}>
      <span className={!selected ? "is-placeholder" : ""}>{label}</span>
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
    </button>
    {open ? <div id={`${id}-calendar`} className="site-date-popover">
      <div className="site-date-heading">
        <button type="button" aria-label="Предыдущий месяц" onClick={() => setCalendarMonth(month.getMonth() - 1)}><span>‹</span></button>
        <div>
          <SiteSelect value={month.getMonth()} onChange={(next) => setCalendarMonth(Number(next))} ariaLabel="Месяц" options={months}/>
          <SiteSelect value={month.getFullYear()} onChange={(next) => setCalendarMonth(undefined, Number(next))} ariaLabel="Год" options={years.map((year) => ({ value: year, label: String(year) }))}/>
        </div>
        <button type="button" aria-label="Следующий месяц" onClick={() => setCalendarMonth(month.getMonth() + 1)}><span>›</span></button>
      </div>
      <DayPicker
        mode="single"
        month={month}
        onMonthChange={setMonth}
        selected={selected}
        onSelect={chooseDay}
        locale={ru}
        hideNavigation
        disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
      />
      {includeTime ? <div className="site-date-time"><span id={`${id}-time-label`}>Время</span><div className="site-time-fields" role="group" aria-labelledby={`${id}-time-label`}>
        <SiteSelect value={time.slice(0, 2)} options={hours} onChange={(hour) => chooseTime(`${hour}:${time.slice(3, 5)}`)} ariaLabel="Часы"/>
        <span aria-hidden="true">:</span>
        <SiteSelect value={time.slice(3, 5)} options={minutes} onChange={(minute) => chooseTime(`${time.slice(0, 2)}:${minute}`)} ariaLabel="Минуты"/>
      </div></div> : null}
      <div className="site-date-actions">
        {value ? <button type="button" onClick={() => onChange("")}>Очистить</button> : <span/>}
        <button type="button" className="site-date-done" onClick={() => setOpen(false)}>Готово</button>
      </div>
    </div> : null}
  </div>;
}
