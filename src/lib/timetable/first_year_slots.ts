export type TimetableSlot = {
  day_of_week: number; // 1 (Mon) - 5 (Fri)
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  course_code: string;
  title: string;
  location: string;
  slot_type: "lecture" | "lab" | "quiz" | "exam" | "deadline" | "event" | "custom";
};

// IIT Bombay First Year Standard Division Slots (D1–D4)
export const DIVISION_SLOTS: Record<string, TimetableSlot[]> = {
  D1: [
    { day_of_week: 1, start_time: "08:30", end_time: "09:25", course_code: "MA 105", title: "Calculus", location: "LA 201", slot_type: "lecture" },
    { day_of_week: 1, start_time: "09:30", end_time: "10:25", course_code: "PH 107", title: "Quantum Physics", location: "LA 201", slot_type: "lecture" },
    { day_of_week: 1, start_time: "14:00", end_time: "17:00", course_code: "PH 117", title: "Physics Lab", location: "Dept Physics Lab", slot_type: "lab" },
    { day_of_week: 2, start_time: "09:30", end_time: "10:55", course_code: "CS 101", title: "Computer Programming", location: "LA 201", slot_type: "lecture" },
    { day_of_week: 2, start_time: "11:05", end_time: "12:30", course_code: "CH 107", title: "Physical Chemistry", location: "LA 201", slot_type: "lecture" },
    { day_of_week: 3, start_time: "08:30", end_time: "09:25", course_code: "MA 105", title: "Calculus Tutorial", location: "LT 101", slot_type: "lecture" },
    { day_of_week: 3, start_time: "14:00", end_time: "17:00", course_code: "CS 101", title: "CS Lab", location: "Old CSE Lab", slot_type: "lab" },
    { day_of_week: 4, start_time: "08:30", end_time: "09:25", course_code: "PH 107", title: "Quantum Physics", location: "LA 201", slot_type: "lecture" },
    { day_of_week: 4, start_time: "10:35", end_time: "11:30", course_code: "MA 105", title: "Calculus", location: "LA 201", slot_type: "lecture" },
    { day_of_week: 5, start_time: "09:30", end_time: "10:55", course_code: "CS 101", title: "Computer Programming", location: "LA 201", slot_type: "lecture" },
    { day_of_week: 5, start_time: "11:05", end_time: "12:30", course_code: "CH 107", title: "Physical Chemistry", location: "LA 201", slot_type: "lecture" },
  ],
  D2: [
    { day_of_week: 1, start_time: "09:30", end_time: "10:25", course_code: "MA 105", title: "Calculus", location: "LA 202", slot_type: "lecture" },
    { day_of_week: 1, start_time: "10:35", end_time: "11:30", course_code: "ME 113", title: "Engineering Graphics", location: "Drawing Hall 1", slot_type: "lecture" },
    { day_of_week: 2, start_time: "14:00", end_time: "17:00", course_code: "ME 113", title: "Workshop / Graphics Lab", location: "Central Workshop", slot_type: "lab" },
    { day_of_week: 3, start_time: "09:30", end_time: "10:25", course_code: "CH 105", title: "General Chemistry", location: "LA 202", slot_type: "lecture" },
    { day_of_week: 4, start_time: "09:30", end_time: "10:25", course_code: "MA 105", title: "Calculus", location: "LA 202", slot_type: "lecture" },
    { day_of_week: 5, start_time: "14:00", end_time: "17:00", course_code: "CH 117", title: "Chemistry Lab", location: "Dept Chemistry Lab", slot_type: "lab" },
  ],
  D3: [
    { day_of_week: 1, start_time: "10:35", end_time: "11:30", course_code: "MA 105", title: "Calculus", location: "LA 301", slot_type: "lecture" },
    { day_of_week: 2, start_time: "08:30", end_time: "09:25", course_code: "EE 101", title: "Introduction to Electrical", location: "LA 301", slot_type: "lecture" },
    { day_of_week: 3, start_time: "14:00", end_time: "17:00", course_code: "EE 111", title: "Electrical Lab", location: "Dept EE Lab", slot_type: "lab" },
    { day_of_week: 4, start_time: "11:35", end_time: "12:30", course_code: "MA 105", title: "Calculus", location: "LA 301", slot_type: "lecture" },
    { day_of_week: 5, start_time: "08:30", end_time: "09:25", course_code: "EE 101", title: "Electrical Engineering", location: "LA 301", slot_type: "lecture" },
  ],
  D4: [
    { day_of_week: 1, start_time: "11:35", end_time: "12:30", course_code: "MA 105", title: "Calculus", location: "LA 302", slot_type: "lecture" },
    { day_of_week: 2, start_time: "14:00", end_time: "17:00", course_code: "CS 101", title: "CS Lab", location: "Mindsparks Lab", slot_type: "lab" },
    { day_of_week: 3, start_time: "10:35", end_time: "11:30", course_code: "CS 101", title: "Programming", location: "LA 302", slot_type: "lecture" },
    { day_of_week: 4, start_time: "14:00", end_time: "15:25", course_code: "MA 105", title: "Calculus", location: "LA 302", slot_type: "lecture" },
    { day_of_week: 5, start_time: "10:35", end_time: "11:30", course_code: "CS 101", title: "Programming", location: "LA 302", slot_type: "lecture" },
  ],
};

// Standard IIT Bombay First Year HASMED Elective Slot Allocations
export const HASMED_SLOTS: Record<string, TimetableSlot[]> = {
  Entrepreneurship: [
    { day_of_week: 2, start_time: "14:00", end_time: "15:25", course_code: "ENT 101", title: "Innovation & Entrepreneurship", location: "LT 201", slot_type: "lecture" },
    { day_of_week: 5, start_time: "14:00", end_time: "15:25", course_code: "ENT 101", title: "Innovation & Entrepreneurship", location: "LT 201", slot_type: "lecture" },
  ],
  Sociology: [
    { day_of_week: 2, start_time: "14:00", end_time: "15:25", course_code: "HS 101", title: "Introduction to Sociology", location: "LA 001", slot_type: "lecture" },
    { day_of_week: 5, start_time: "14:00", end_time: "15:25", course_code: "HS 101", title: "Introduction to Sociology", location: "LA 001", slot_type: "lecture" },
  ],
  Philosophy: [
    { day_of_week: 2, start_time: "14:00", end_time: "15:25", course_code: "HS 103", title: "Introduction to Philosophy", location: "LA 002", slot_type: "lecture" },
    { day_of_week: 5, start_time: "14:00", end_time: "15:25", course_code: "HS 103", title: "Introduction to Philosophy", location: "LA 002", slot_type: "lecture" },
  ],
  Psychology: [
    { day_of_week: 2, start_time: "14:00", end_time: "15:25", course_code: "HS 105", title: "General Psychology", location: "LT 102", slot_type: "lecture" },
    { day_of_week: 5, start_time: "14:00", end_time: "15:25", course_code: "HS 105", title: "General Psychology", location: "LT 102", slot_type: "lecture" },
  ],
  Literature: [
    { day_of_week: 2, start_time: "14:00", end_time: "15:25", course_code: "HS 107", title: "Introduction to Literature", location: "LA 101", slot_type: "lecture" },
    { day_of_week: 5, start_time: "14:00", end_time: "15:25", course_code: "HS 107", title: "Introduction to Literature", location: "LA 101", slot_type: "lecture" },
  ],
  Ecology: [
    { day_of_week: 2, start_time: "14:00", end_time: "15:25", course_code: "ES 101", title: "Environmental Studies & Ecology", location: "LT 103", slot_type: "lecture" },
    { day_of_week: 5, start_time: "14:00", end_time: "15:25", course_code: "ES 101", title: "Environmental Studies & Ecology", location: "LT 103", slot_type: "lecture" },
  ],
  "NCC/NSO/NSS": [
    { day_of_week: 2, start_time: "17:15", end_time: "18:45", course_code: "NSO 101", title: "Physical Training / Activity", location: "Gymkhana Grounds", slot_type: "custom" },
    { day_of_week: 4, start_time: "17:15", end_time: "18:45", course_code: "NSO 101", title: "Physical Training / Activity", location: "Gymkhana Grounds", slot_type: "custom" },
  ],
  Management: [
    { day_of_week: 2, start_time: "14:00", end_time: "15:25", course_code: "MG 101", title: "Introduction to Management", location: "SJMSOM 101", slot_type: "lecture" },
    { day_of_week: 5, start_time: "14:00", end_time: "15:25", course_code: "MG 101", title: "Introduction to Management", location: "SJMSOM 101", slot_type: "lecture" },
  ],
};

// Generates actual Date instances for slots in a given week, combining division & HASMED elective
export function getSlotsForWeek(
  division: string = "D1",
  mondayDate: Date = new Date(),
  hasmedElective?: string
): Array<TimetableSlot & { start_datetime: string; end_datetime: string }> {
  const baseSlots = [...(DIVISION_SLOTS[division] || DIVISION_SLOTS.D1)];

  if (hasmedElective && HASMED_SLOTS[hasmedElective]) {
    baseSlots.push(...HASMED_SLOTS[hasmedElective]);
  }

  const monday = new Date(mondayDate);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);

  return baseSlots.map((slot) => {
    const slotDate = new Date(monday);
    slotDate.setDate(monday.getDate() + (slot.day_of_week - 1));

    const [startH, startM] = slot.start_time.split(":").map(Number);
    const [endH, endM] = slot.end_time.split(":").map(Number);

    const startDt = new Date(slotDate);
    startDt.setHours(startH, startM, 0, 0);

    const endDt = new Date(slotDate);
    endDt.setHours(endH, endM, 0, 0);

    return {
      ...slot,
      start_datetime: startDt.toISOString(),
      end_datetime: endDt.toISOString(),
    };
  });
}
