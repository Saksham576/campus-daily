import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret } from "@/lib/server/crypto";
import { moodleCall, MOODLE_URL } from "@/lib/moodle";
import { syncEnrolments } from "@/lib/server/moodleSync";

/**
 * Moodle's app login ends with a redirect to moodlemobile://token=<base64 "sig:::token[:::private]">,
 * where sig = md5(wwwroot + passport). Returns the 32-hex token, or null if it isn't ours.
 */
export function tokenFromLaunchRedirect(location: string, passport: string, wwwroot = MOODLE_URL): string | null {
  const m = String(location).match(/token=([A-Za-z0-9+/=_-]+)/);
  if (!m) return null;
  const [signature, token] = Buffer.from(m[1], "base64").toString("utf8").split(":::");
  const expected = createHash("md5").update(wwwroot + passport).digest("hex");
  if (signature !== expected || !/^[a-f0-9]{32}$/i.test(token || "")) return null;
  return token;
}

/** Check the key with Moodle, then store it encrypted for this student. */
export async function saveMoodleKey(admin: SupabaseClient, userId: string, key: string): Promise<{ name: string }> {
  const info = await moodleCall<{ userid: number; fullname: string }>(key, "core_webservice_get_site_info");
  const { error } = await admin.from("moodle_connections").upsert({
    user_id: userId,
    moodle_userid: info.userid,
    moodle_fullname: info.fullname,
    token_enc: encryptSecret(key),
    connected_at: new Date().toISOString(),
    last_error: null,
  });
  if (error) throw new Error("save");
  // Right away: their courses (so classmates' files show in Library) and timetable courses.
  await syncEnrolments(admin, userId, info.userid, key).catch(() => null);
  return { name: info.fullname };
}
