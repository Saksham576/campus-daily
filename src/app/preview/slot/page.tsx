"use client";

import { AppBar } from "@/components/AppBar";
import { CalendarImport } from "@/components/CalendarImport";
import { SlotForm } from "@/components/SlotForm";

/** Dev-only: the add-slot and calendar-import panels, for design work without signing in. */
export default function PreviewSlot() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <>
      <AppBar />
      <main id="main" className="wrap">
        <div className="page-head">
          <div>
            <p className="eyebrow">Autumn 2026-27</p>
            <h1>Timetable</h1>
          </div>
        </div>
        <SlotForm onClose={() => {}} onSaved={() => {}} />
        <CalendarImport
          feed={{ host: "calendar.google.com", last_sync_at: new Date().toISOString(), last_count: 14, last_error: null, slot_type: "event" }}
          onDone={() => {}}
          onClose={() => {}}
        />
      </main>
    </>
  );
}
