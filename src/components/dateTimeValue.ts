// A cleared or malformed time must never reach Intl.DateTimeFormat.
export function pickerTime(value: string): string {
  const match = value.match(/T([01]\d|2[0-3]):([0-5]\d)(?=$|:|Z|[+-])/);
  return match ? `${match[1]}:${match[2]}` : "12:00";
}
