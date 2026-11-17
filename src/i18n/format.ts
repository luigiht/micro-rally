/** Replaces `{name}` placeholders in a message. */
export function fill(template: string, vars: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}

/** Stage clock: m:ss.cc */
export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(2).padStart(5, '0')}`;
}

/** A short span such as air time or a penalty, to a tenth: "2.4s". */
export function formatSeconds(seconds: number): string {
  return `${Math.max(0, seconds).toFixed(1)}s`;
}

export function formatMoney(amount: number, locale: string): string {
  return `$${Math.round(amount).toLocaleString(locale)}`;
}
