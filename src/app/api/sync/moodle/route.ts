import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseIcs } from "@/lib/events";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Optional override url from body, otherwise fetch from subscriber profile
    let moodleUrl: string | undefined;
    try {
      const body = await req.json();
      moodleUrl = body.url;
    } catch {
      // No JSON body provided, fall back to profile
    }

    if (!moodleUrl) {
      const { data: sub } = await supabase
        .from("subscribers")
        .select("moodle_ical_url")
        .eq("email", user.email)
        .single();

      moodleUrl = sub?.moodle_ical_url;
    }

    if (!moodleUrl || !moodleUrl.trim()) {
      return NextResponse.json(
        {
          error:
            "No Moodle iCal URL configured. Paste your private Moodle Calendar export link in Settings.",
        },
        { status: 400 }
      );
    }

    // Fetch the raw iCalendar stream from Moodle
    const res = await fetch(moodleUrl.trim(), {
      headers: {
        "User-Agent": "CampusDaily-TimetableSync/1.0",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `Moodle server responded with status ${res.status}. Please check your export URL.`,
        },
        { status: 502 }
      );
    }

    const icsText = await res.text();
    const events = parseIcs(icsText);

    if (events.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Connected to Moodle, but no active events or upcoming deadlines found.",
        synced: 0,
      });
    }

    // Fetch existing user schedules to prevent duplicate inserts
    const { data: existingSchedules } = await supabase
      .from("user_schedules")
      .select("title, start_time")
      .eq("user_id", user.id);

    const existingKeys = new Set(
      (existingSchedules || []).map((s) => `${s.title}|${s.start_time}`)
    );

    const rowsToInsert = events
      .filter((ev) => !existingKeys.has(`${ev.title}|${ev.start_time}`))
      .map((ev) => ({
        user_id: user.id,
        title: ev.title,
        location: ev.location || "Moodle Online",
        start_time: ev.start_time,
        end_time: ev.end_time || ev.start_time,
        slot_type: ev.slot_type,
        is_cancelled: ev.is_cancelled || false,
      }));

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("user_schedules")
        .insert(rowsToInsert);

      if (insertError) {
        return NextResponse.json(
          { error: `Database insert failed: ${insertError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      synced: rowsToInsert.length,
      total: events.length,
      message: `Successfully synced ${rowsToInsert.length} new deadline(s) from Moodle.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to sync Moodle deadlines." },
      { status: 500 }
    );
  }
}
