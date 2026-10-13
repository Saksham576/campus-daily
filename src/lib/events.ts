export type ExtractedEvent = {
  is_event: boolean;
  title: string;
  location?: string;
  start_time: string; // ISO string
  end_time?: string; // ISO string
  slot_type: "lecture" | "lab" | "quiz" | "exam" | "deadline" | "event" | "custom";
  course_code?: string;
  is_cancelled?: boolean;
};

// Heuristic structured event extractor from notice subject + body
export function extractEventDetails(
  subject: string,
  body: string = ""
): ExtractedEvent | null {
  const text = `${subject} \n ${body}`;
  const lower = text.toLowerCase();

  // Detect cancellations
  const is_cancelled =
    lower.includes("cancelled") ||
    lower.includes("canceled") ||
    lower.includes("no class") ||
    lower.includes("no lecture") ||
    lower.includes("class dismissed") ||
    lower.includes("postponed");

  // Determine slot type
  let slot_type: ExtractedEvent["slot_type"] = "event";
  if (lower.includes("quiz")) slot_type = "quiz";
  else if (lower.includes("midsem") || lower.includes("endsem") || lower.includes("exam"))
    slot_type = "exam";
  else if (lower.includes("lab") || lower.includes("practical")) slot_type = "lab";
  else if (lower.includes("lecture") || lower.includes("class") || lower.includes("tutorial"))
    slot_type = "lecture";
  else if (lower.includes("deadline") || lower.includes("submission") || lower.includes("due date"))
    slot_type = "deadline";

  // Course code extraction e.g. MA 105, CS 101, PH 107
  const courseMatch = text.match(/\b([A-Z]{2,3}\s*[0-9]{3})\b/);
  const course_code = courseMatch ? courseMatch[1].replace(/\s+/, " ") : undefined;

  // Venue extraction e.g. LA 201, LT 101, LH 102, F.C. Kohli, Convocation Hall
  const venueMatch = text.match(
    /\b(?:LA|LT|LH|PC|SIC|LC)\s*[-–]?\s*[0-9]{1,3}\b|Convocation Hall|Gymkhana|SAC|F\.C\.\s*Kohli/i
  );
  const location = venueMatch ? venueMatch[0] : undefined;

  // Date/Time extraction heuristics
  // Check for time like 14:00, 2:00 PM, 8:30 AM
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  const now = new Date();
  let start = new Date(now);

  // Check for dates like "23 Oct", "23rd October", "Tomorrow"
  const dateMatch = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i
  );

  const isTomorrow = lower.includes("tomorrow");
  const isToday = lower.includes("today");

  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const monthNames = [
      "jan", "feb", "mar", "apr", "may", "jun",
      "jul", "aug", "sep", "oct", "nov", "dec"
    ];
    const month = monthNames.findIndex((m) =>
      dateMatch[2].toLowerCase().startsWith(m)
    );
    if (month !== -1) {
      start.setMonth(month);
      start.setDate(day);
    }
  } else if (isTomorrow) {
    start.setDate(start.getDate() + 1);
  }

  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridian = timeMatch[3]?.toLowerCase();

    if (meridian === "pm" && hour < 12) hour += 12;
    if (meridian === "am" && hour === 12) hour = 0;

    start.setHours(hour, minute, 0, 0);
  } else {
    // Default 10:00 AM
    start.setHours(10, 0, 0, 0);
  }

  const end = new Date(start);
  end.setHours(start.getHours() + (slot_type === "lab" ? 3 : slot_type === "exam" ? 3 : 1));

  // Determine if it actually qualifies as an event
  const isEventNotice =
    is_cancelled ||
    Boolean(course_code) ||
    Boolean(location) ||
    slot_type === "quiz" ||
    slot_type === "exam" ||
    slot_type === "deadline" ||
    lower.includes("schedule") ||
    lower.includes("venue") ||
    lower.includes("timing");

  if (!isEventNotice) {
    return null;
  }

  const cleanTitle = course_code
    ? `${course_code} ${slot_type.toUpperCase()}${is_cancelled ? " (CANCELLED)" : ""}`
    : subject.length > 50
    ? subject.slice(0, 47) + "…"
    : subject;

  return {
    is_event: true,
    title: cleanTitle,
    location,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    slot_type,
    course_code,
    is_cancelled,
  };
}

// Generate RFC 5545 .ics Calendar content
export function generateIcs(event: {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time?: string;
}): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const formatIcsDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(
      d.getUTCDate()
    )}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(
      d.getUTCSeconds()
    )}Z`;
  };

  const dtStart = formatIcsDate(event.start_time);
  const dtEnd = event.end_time
    ? formatIcsDate(event.end_time)
    : formatIcsDate(
        new Date(new Date(event.start_time).getTime() + 3600000).toISOString()
      );
  const dtStamp = formatIcsDate(new Date().toISOString());
  const uid = `campus-daily-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@campusdaily.iitb`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Campus Daily//IIT Bombay Timetable//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${event.title.replace(/[,;]/g, " ")}`,
    event.description ? `DESCRIPTION:${event.description.replace(/\n/g, "\\n").replace(/[,;]/g, " ")}` : "",
    event.location ? `LOCATION:${event.location.replace(/[,;]/g, " ")}` : "",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

// Generate 1-tap Google Calendar web link
export function getGoogleCalendarUrl(event: {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time?: string;
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

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
