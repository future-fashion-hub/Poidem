type Unit = "events" | "companies" | "members";
const forms: Record<Unit, [string, string, string]> = {
  events: ["событие", "события", "событий"],
  companies: ["компания", "компании", "компаний"],
  members: ["участник", "участника", "участников"],
};
export function countWord(value: number, unit: Unit) {
  const n = Math.abs(Math.trunc(value)), last = n % 10, teen = n % 100;
  return forms[unit][teen >= 11 && teen <= 14 ? 2 : last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2];
}
export function countLabel(value: number, unit: Unit) { return `${value} ${countWord(value, unit)}`; }
