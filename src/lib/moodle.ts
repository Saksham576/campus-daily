/** IIT Bombay Moodle (moodle.iitb.ac.in) — the same web-service API the official Moodle app uses. */
export const MOODLE_URL = "https://moodle.iitb.ac.in";

type Fetch = typeof fetch;

export async function moodleLogin(username: string, password: string, f: Fetch = fetch): Promise<string> {
  const body = new URLSearchParams({ username, password, service: "moodle_mobile_app" });
  const res = await f(`${MOODLE_URL}/login/token.php`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const j: any = await res.json().catch(() => ({}));
  if (!j.token) throw new Error(j.errorcode === "invalidlogin" ? "Wrong Moodle username or password." : j.error || "Moodle login failed.");
  return j.token as string;
}

/** Call a Moodle web-service function. Arrays are passed as name[0]=…, objects as name[key]=…. */
export async function moodleCall<T = any>(token: string, fn: string, params: Record<string, unknown> = {}, f: Fetch = fetch): Promise<T> {
  const qs = new URLSearchParams({ wstoken: token, wsfunction: fn, moodlewsrestformat: "json" });
  const add = (k: string, v: unknown) => {
    if (Array.isArray(v)) v.forEach((x, i) => add(`${k}[${i}]`, x));
    else if (v && typeof v === "object") Object.entries(v).forEach(([kk, vv]) => add(`${k}[${kk}]`, vv));
    else if (v !== undefined && v !== null) qs.append(k, String(v));
  };
  Object.entries(params).forEach(([k, v]) => add(k, v));
  const res = await f(`${MOODLE_URL}/webservice/rest/server.php`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: qs,
  });
  const j: any = await res.json();
  if (j && j.exception) throw new Error(`${fn}: ${j.errorcode || j.message}`);
  return j as T;
}

/** "CH 111-2026-1-D3" / "MA105-2026" → "CH 111" (null if no course code). */
export function courseCodeFromShortname(shortname: string): string | null {
  const m = shortname.match(/\b([A-Z]{2,3})\s?-?(\d{3}[A-Z]?)\b/i);
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : null;
}

/** Files worth reading with AI: seating plans and room/venue lists for quizzes/exams. */
export function isSeatingFile(name: string): boolean {
  return /(seat|seating|sitting|room\s*allot|venue|hall\s*plan|arrangement|roll\s*list)/i.test(name) && /\.(pdf|xlsx?|csv)$/i.test(name);
}

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/** Pluginfile URLs need the token appended to download. Never store or show the result. */
export function withToken(fileurl: string, token: string): string {
  return `${fileurl}${fileurl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

/** Roll number from an IITB email: "26B2477@iitb.ac.in" → "26b2477". */
export function rollFromEmail(email: string): string {
  return email.split("@")[0].trim().toLowerCase();
}
