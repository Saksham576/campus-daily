import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/AppBar";
import { LibraryView, type LibFile } from "@/components/LibraryView";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: only files of courses you take.
  const { data, error } = await supabase
    .from("course_files")
    .select("course_id, course_code, course_short, section, module, name, mimetype, view_url, modified_at")
    .order("modified_at", { ascending: false, nullsFirst: false })
    .limit(3000);

  return (
    <>
      <AppBar />
      <main id="main" className="wrap">
        <div className="page-head">
          <div>
            <p className="eyebrow">From Moodle · updated every 15 min</p>
            <h1>Course files</h1>
          </div>
        </div>
        {error && <p className="err">Could not load files: {error.message}</p>}
        <LibraryView files={(data || []) as LibFile[]} />
      </main>
    </>
  );
}
