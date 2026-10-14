import { useEffect, useState } from "react";
import type { CompanyEventIndex } from "../api/companyAvailability";

export function useEventClock(events: CompanyEventIndex) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const current = Date.now();
    const ends = Object.values(events).flatMap(event => {
      const end = event ? Date.parse(event.endsAt || event.startsAt) : NaN;
      return Number.isFinite(end) && end > current ? [end] : [];
    });
    const wait = Math.min(60000, Math.max(1, Math.min(...ends) - current + 10));
    const timer = window.setTimeout(() => setNow(Date.now()), wait);
    const resume = () => setNow(Date.now());
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, [events, now]);
  // Include time spent fetching metadata, not just the previous timer tick.
  return Date.now();
}
