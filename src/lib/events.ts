export type ExtractedEvent = {
  is_event: boolean;
  title: string;
  location?: string;
  start_time: string; // ISO string
  end_time?: string; // ISO string
  slot_type: "lecture" | "lab" | "quiz" | "exam" | "deadline" | "event" | "custom";
  course_code?: string;
  is_cancelled?: boolean;
  rrule?: string;
  description?: string;
  uid?: string;
};

// Helper: escape text for RFC 5545 iCalendar format
export function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Helper: parse time strings like "2:00 PM", "9:30 AM", "14:00", "2 PM", "08:30"
export function parseHourMinute(timeStr: string): { hour: number; minute: number } | null {
  const match = timeStr.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const meridian = match[3]?.toLowerCase();

  if (meridian === "pm" && hour < 12) hour += 12;
  if (meridian === "am" && hour === 12) hour = 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
}

// Helper: extract time (start and optional end) from notice text
export function extractTimeFromText(text: string): {
  startHour: number;
  startMinute: number;
  endHour?: number;
  endMinute?: number;
} | null {
  // Check for time ranges: "9:30 AM to 12:30 PM", "14:00 - 17:00", "2:00 PM - 3:30 PM", "2 to 5 PM"
  const rangeMatch = text.match(
    /\b(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-|–)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i
  );
  if (rangeMatch) {
    const sStr = rangeMatch[1].trim();
    const eStr = rangeMatch[2].trim();
    const sHasMeridian = /am|pm/i.test(sStr);
    const eHasMeridian = /am|pm/i.test(eStr);
    const s = parseHourMinute(sStr);
    const e = parseHourMinute(eStr);
    if (s && e) {
      let startHour = s.hour;
      const startMinute = s.minute;
      let endHour = e.hour;
      const endMinute = e.minute;

      // Propagate PM meridian to start when start time omitted meridian (e.g. "from 2 to 5 PM")
      if (eHasMeridian && /pm/i.test(eStr) && !sHasMeridian && startHour < 12) {
        const end12 = endHour % 12 || 12;
        if (startHour <= end12) {
          startHour += 12;
        }
      }

      return {
        startHour,
        startMinute,
        endHour,
        endMinute,
      };
    } else if (s) {
      return {
        startHour: s.hour,
        startMinute: s.minute,
      };
    }
  }

  // Check for explicit time with minutes: "9:30 AM", "14:00", "08:30"
  const colonTime = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?:\s*(am|pm))?\b/i);
  if (colonTime) {
    let hour = parseInt(colonTime[1], 10);
    const minute = parseInt(colonTime[2], 10);
    const meridian = colonTime[3]?.toLowerCase();
    if (meridian === "pm" && hour < 12) hour += 12;
    if (meridian === "am" && hour === 12) hour = 0;
    if (!meridian && hour >= 1 && hour <= 6) hour += 12;
    return { startHour: hour, startMinute: minute };
  }

  // Check for hour with am/pm: "2 PM", "10 AM", "3 pm"
  const meridianTime = text.match(/\b([1-9]|1[0-2])\s*(am|pm)\b/i);
  if (meridianTime) {
    let hour = parseInt(meridianTime[1], 10);
    const meridian = meridianTime[2].toLowerCase();
    if (meridian === "pm" && hour < 12) hour += 12;
    if (meridian === "am" && hour === 12) hour = 0;
    return { startHour: hour, startMinute: 0 };
  }

  // Check for "at <number>": "at 2", "at 4", "at 9:30"
  const atTime = text.match(/\bat\s+([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)?\b/i);
  if (atTime) {
    let hour = parseInt(atTime[1], 10);
    const minute = atTime[2] ? parseInt(atTime[2], 10) : 0;
    const meridian = atTime[3]?.toLowerCase();
    if (meridian === "pm" && hour < 12) hour += 12;
    if (meridian === "am" && hour === 12) hour = 0;
    if (!meridian && hour >= 1 && hour <= 6) hour += 12;
    return { startHour: hour, startMinute: minute };
  }

  return null;
}

// Moodle/Bodhitree forum mails carry "by Name - Wednesday, 14 October 2026, 5:15 PM": the posting
// time, not the event time. It must never be read as the event date.
export const POSTED_LINE_RE =
  /\bby\s[^\n]{0,80}?\s[-–]\s(?:mon|tues|wednes|thurs|fri|satur|sun)day,?\s+\d{1,2}\s+[a-z]+\s+\d{4},?\s+\d{1,2}:\d{2}\s*(?:am|pm)?/gi;

// Heuristic structured event extractor from notice subject + body
export function extractEventDetails(
  subject: string,
  rawBody: string = ""
): ExtractedEvent | null {
  const body = rawBody.replace(POSTED_LINE_RE, " ");
  const text = `${subject} \n ${body}`;
  const lower = text.toLowerCase();

  // Detect course code e.g. MA 105, CS 101, PH 107
  // Exclude venue prefixes LA, LT, LH, SIC, PC, LC, CC, MB
  const courseMatch = text.match(
    /\b(?!(?:LA|LT|LH|SIC|PC|LC|CC|MB)\b)([A-Z]{2,3})\s*([0-9]{3}[A-Z]?)\b/i
  );
  const course_code = courseMatch
    ? `${courseMatch[1].toUpperCase()} ${courseMatch[2].toUpperCase()}`
    : undefined;

  // Venue extraction e.g. LA 201, LT 101, LH 102, F.C. Kohli, Convocation Hall
  const venueMatch = text.match(
    /\b(?:LA|LT|LH|SIC|PC|LC|CC|MB)\s*[-–]?\s*[0-9]{1,3}\b|Convocation Hall|Gymkhana|SAC|F\.C\.\s*Kohli|Central Workshop|Drawing Hall\s*[0-9]?|Mindsparks\s*Lab|Old CSE Lab|Dept\s+[A-Za-z\s]+Lab/i
  );
  const location = venueMatch ? venueMatch[0].trim() : undefined;

  // Determine slot type
  let slot_type: ExtractedEvent["slot_type"] = "event";
  if (lower.includes("quiz")) slot_type = "quiz";
  else if (lower.includes("midsem") || lower.includes("endsem") || lower.includes("exam"))
    slot_type = "exam";
  else if (lower.includes("lab") || lower.includes("practical") || lower.includes("workshop"))
    slot_type = "lab";
  else if (
    lower.includes("lecture") ||
    lower.includes("class") ||
    lower.includes("tutorial") ||
    lower.includes("tut ")
  )
    slot_type = "lecture";
  else if (
    lower.includes("deadline") ||
    lower.includes("submission") ||
    lower.includes("due date") ||
    lower.includes("due on") ||
    lower.includes("assignment")
  )
    slot_type = "deadline";

  // Detect class / event cancellations in academic context
  const isCancelKeyword =
    /\b(cancelled|canceled|postponed|no\s+(?:class|lecture|lab|tut|tutorial)|class\s+dismissed)\b/i.test(
      lower
    );

  const isAcademicContext =
    Boolean(course_code) ||
    slot_type !== "event" ||
    lower.includes("lecture") ||
    lower.includes("class") ||
    lower.includes("exam");

  const is_cancelled = isCancelKeyword && isAcademicContext;

  // Check if this notice qualifies as a timetable / calendar event
  const hasTiming = extractTimeFromText(text) !== null;
  const hasDate =
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i.test(
      text
    ) ||
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i.test(
      text
    ) ||
    /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/.test(text) ||
    /\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/.test(text) ||
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(text) ||
    lower.includes("tomorrow") ||
    lower.includes("today");

  const isEventNotice =
    Boolean(course_code) ||
    (slot_type !== "event" && (hasTiming || hasDate || Boolean(location))) ||
    (is_cancelled && isAcademicContext) ||
    (Boolean(location) && hasTiming && hasDate) ||
    // Web-page items carry an explicit "When: 24 October 2026, 10:00 AM" line.
    (hasTiming && hasDate && /^When: /m.test(rawBody));

  if (!isEventNotice) {
    return null;
  }

  // Parse Date
  const monthNames = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
  ];
  const now = new Date();
  let targetYear = now.getFullYear();
  let targetMonth = now.getMonth();
  let targetDay = now.getDate();

  // The subject states the event ("Quiz on Friday, October 16th"); bodies often mention other dates.
  const SUBJECT_HAS_DATE =
    /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?\b|\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/i;
  const dateText = SUBJECT_HAS_DATE.test(subject) ? subject : text;

  // 1. Day Month format: "23rd October", "23 Oct 2026"
  const dayMonthMatch = dateText.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s*,?\s*(\d{4}))?\b/i
  );

  // 2. Month Day format: "October 23rd", "Oct 23, 2026"
  const monthDayMatch = dateText.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i
  );

  // 3. ISO format: "2026-10-23", "2026/10/23"
  const isoDateMatch = dateText.match(/\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);

  // 4. Numeric format: "23/10/2026", "23-10-2026"
  // First plausible DD/MM — skips academic years ("2026-27"), ranges ("2-5", "45-4") and similar.
  const numericMatch =
    Array.from(dateText.matchAll(/(?<![\d\-\/])(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?(?![\d\-\/])/g)).find((m) => {
      const d = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      return d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && (Boolean(m[3]) || m[0].includes("/"));
    }) || null;

  // 5. Day of week format: "Friday", "this Monday"
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayMatch = text.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);

  if (dayMonthMatch) {
    targetDay = parseInt(dayMonthMatch[1], 10);
    const mIdx = monthNames.findIndex((m) =>
      dayMonthMatch[2].toLowerCase().startsWith(m)
    );
    if (mIdx !== -1) targetMonth = mIdx;
    if (dayMonthMatch[3]) targetYear = parseInt(dayMonthMatch[3], 10);
  } else if (monthDayMatch) {
    targetDay = parseInt(monthDayMatch[2], 10);
    const mIdx = monthNames.findIndex((m) =>
      monthDayMatch[1].toLowerCase().startsWith(m)
    );
    if (mIdx !== -1) targetMonth = mIdx;
    if (monthDayMatch[3]) targetYear = parseInt(monthDayMatch[3], 10);
  } else if (isoDateMatch) {
    targetYear = parseInt(isoDateMatch[1], 10);
    targetMonth = parseInt(isoDateMatch[2], 10) - 1;
    targetDay = parseInt(isoDateMatch[3], 10);
  } else if (numericMatch) {
    targetDay = parseInt(numericMatch[1], 10);
    targetMonth = parseInt(numericMatch[2], 10) - 1;
    if (numericMatch[3]) {
      const y = parseInt(numericMatch[3], 10);
      targetYear = y < 100 ? 2000 + y : y;
    }
  } else if (lower.includes("tomorrow")) {
    const tomorrow = new Date(now.getTime() + 86400000);
    targetYear = tomorrow.getFullYear();
    targetMonth = tomorrow.getMonth();
    targetDay = tomorrow.getDate();
  } else if (dayMatch) {
    const targetDayOfWeek = weekdays.indexOf(dayMatch[1].toLowerCase());
    const currentDayOfWeek = now.getDay();
    let diff = targetDayOfWeek - currentDayOfWeek;
    if (diff <= 0) diff += 7;
    const targetDate = new Date(now.getTime() + diff * 86400000);
    targetYear = targetDate.getFullYear();
    targetMonth = targetDate.getMonth();
    targetDay = targetDate.getDate();
  }

  // Parse Time
  const timeParsed = extractTimeFromText(text);
  const startHour = timeParsed ? timeParsed.startHour : 10; // Default 10:00 AM IST
  const startMinute = timeParsed ? timeParsed.startMinute : 0;

  let endHour = timeParsed?.endHour;
  let endMinute = timeParsed?.endMinute ?? 0;
  if (endHour === undefined) {
    const durationHours = slot_type === "lab" ? 3 : slot_type === "exam" ? 3 : 1;
    endHour = startHour + durationHours;
  }

  // Construct precise ISO string in IST (+05:30)
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const startIsoStr = `${targetYear}-${pad(targetMonth + 1)}-${pad(targetDay)}T${pad(
    startHour
  )}:${pad(startMinute)}:00+05:30`;
  const endIsoStr = `${targetYear}-${pad(targetMonth + 1)}-${pad(targetDay)}T${pad(
    endHour
  )}:${pad(endMinute)}:00+05:30`;

  const startUtc = new Date(startIsoStr);
  let endUtc = new Date(endIsoStr);

  // Impossible dates/times in notice text (e.g. "31/02", "45th", "25:00") must never crash the feed.
  const realDate = new Date(Date.UTC(targetYear, targetMonth, targetDay));
  if (
    isNaN(startUtc.getTime()) ||
    realDate.getUTCMonth() !== targetMonth ||
    realDate.getUTCDate() !== targetDay
  ) {
    return null;
  }
  if (isNaN(endUtc.getTime()) || endUtc.getTime() < startUtc.getTime()) {
    endUtc = new Date(startUtc.getTime() + 3600 * 1000);
  }

  const cleanTitle = course_code
    ? `${course_code} ${slot_type.toUpperCase()}${is_cancelled ? " (CANCELLED)" : ""}`
    : is_cancelled && !subject.toUpperCase().includes("CANCELLED")
    ? `${subject.length > 40 ? subject.slice(0, 37) + "…" : subject} (CANCELLED)`
    : subject.length > 50
    ? subject.slice(0, 47) + "…"
    : subject;

  return {
    is_event: true,
    title: cleanTitle,
    location,
    start_time: startUtc.toISOString(),
    end_time: endUtc.toISOString(),
    slot_type,
    course_code,
    is_cancelled,
  };
}

// Generate RFC 5545 .ics Calendar content for a single event
export function generateIcs(event: {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time?: string;
  rrule?: string;
}): string {
  return generateMultiEventIcs([event]);
}

// Generate RFC 5545 .ics Calendar stream for multiple events
export function generateMultiEventIcs(
  events: Array<{
    title: string;
    description?: string;
    location?: string;
    start_time: string;
    end_time?: string;
    rrule?: string;
    uid?: string;
  }>
): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const formatIcsDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(
      d.getUTCDate()
    )}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(
      d.getUTCSeconds()
    )}Z`;
  };

  const dtStamp = formatIcsDate(new Date().toISOString());

  const vevents = events
    .map((ev, idx) => {
      const uid =
        ev.uid ||
        `campus-daily-${Date.now()}-${idx}-${Math.random()
          .toString(36)
          .substring(2, 8)}@campusdaily.iitb`;
      const dtStart = formatIcsDate(ev.start_time);
      const dtEnd = ev.end_time
        ? formatIcsDate(ev.end_time)
        : formatIcsDate(
            new Date(new Date(ev.start_time).getTime() + 3600000).toISOString()
          );

      const lines = [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${escapeIcsText(ev.title)}`,
      ];

      if (ev.description) {
        lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
      }
      if (ev.location) {
        lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
      }
      if (ev.rrule) {
        lines.push(`RRULE:${ev.rrule}`);
      }
      lines.push("STATUS:CONFIRMED");
      lines.push("END:VEVENT");

      return lines.join("\r\n");
    })
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Campus Daily//IIT Bombay Timetable//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    vevents,
    "END:VCALENDAR",
  ].join("\r\n");
}

// Generate 1-tap Google Calendar web link
export function getGoogleCalendarUrl(event: {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time?: string;
  rrule?: string;
}): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const formatGCalDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(
      d.getUTCDate()
    )}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(
      d.getUTCSeconds()
    )}Z`;
  };

  const start = formatGCalDate(event.start_time);
  const end = event.end_time
    ? formatGCalDate(event.end_time)
    : formatGCalDate(new Date(new Date(event.start_time).getTime() + 3600000).toISOString());

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    details: event.description || "Added via Campus Daily IIT Bombay",
    location: event.location || "IIT Bombay",
  });

  if (event.rrule) {
    params.set("recur", `RRULE:${event.rrule}`);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// RFC 5545 iCalendar Parser (e.g. for Moodle Calendar iCal sync)
export function parseIcs(icsText: string): ExtractedEvent[] {
  const events: ExtractedEvent[] = [];
  const veventBlocks = icsText.split(/BEGIN:VEVENT/i).slice(1);

  for (const block of veventBlocks) {
    const content = block.split(/END:VEVENT/i)[0];
    if (!content) continue;

    const getProp = (name: string): string | undefined => {
      // Handles unescaped multi-line folded headers if any
      const match = content.match(new RegExp(`(?:^|\\r?\\n)${name}(?:;[^:]*)?:(.*(?:\r?\n[ \t].*)*)`, "i"));
      if (!match) return undefined;
      return match[1].replace(/\r?\n[ \t]/g, "").trim();
    };

    const unescapeIcs = (val: string) =>
      val
        .replace(/\\n/gi, "\n")
        .replace(/\\,/g, ",")
        .replace(/\\;/g, ";")
        .replace(/\\\\/g, "\\");

    const rawSummary = getProp("SUMMARY") || "Moodle Event";
    const summary = unescapeIcs(rawSummary);
    const rawDesc = getProp("DESCRIPTION");
    const description = rawDesc ? unescapeIcs(rawDesc) : undefined;
    const rawLoc = getProp("LOCATION");
    const location = rawLoc ? unescapeIcs(rawLoc) : undefined;
    const uid = getProp("UID");

    const dtStartRaw = getProp("DTSTART");
    const dtEndRaw = getProp("DTEND");

    const parseIcsDate = (dateStr?: string): string | null => {
      if (!dateStr) return null;
      // Format: 20261028T182900Z or 20261028T182900 or 20261028
      const m = dateStr.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
      if (!m) return null;
      const [, y, mon, d, h = "00", min = "00", s = "00", isUtc] = m;
      if (isUtc) {
        return new Date(Date.UTC(+y, +mon - 1, +d, +h, +min, +s)).toISOString();
      } else {
        // Assume IST if floating
        return new Date(`${y}-${mon}-${d}T${h}:${min}:${s}+05:30`).toISOString();
      }
    };

    const startTime = parseIcsDate(dtStartRaw) || new Date().toISOString();
    const endTime = parseIcsDate(dtEndRaw) || startTime;

    // Detect slot type from summary/description
    const lower = `${summary} ${description || ""}`.toLowerCase();
    let slotType: ExtractedEvent["slot_type"] = "deadline";
    if (lower.includes("quiz")) slotType = "quiz";
    else if (lower.includes("exam") || lower.includes("midsem") || lower.includes("endsem"))
      slotType = "exam";
    else if (lower.includes("lab") || lower.includes("practical")) slotType = "lab";
    else if (lower.includes("lecture") || lower.includes("class")) slotType = "lecture";

    // Course code
    const courseMatch = summary.match(
      /\b(?!(?:LA|LT|LH|SIC|PC|LC)\b)([A-Z]{2,3})\s*([0-9]{3}[A-Z]?)\b/i
    );
    const courseCode = courseMatch
      ? `${courseMatch[1].toUpperCase()} ${courseMatch[2].toUpperCase()}`
      : undefined;

    events.push({
      is_event: true,
      title: summary,
      description,
      location,
      start_time: startTime,
      end_time: endTime,
      slot_type: slotType,
      course_code: courseCode,
      uid,
      is_cancelled: lower.includes("cancelled") || lower.includes("canceled"),
    });
  }

  return events;
}
