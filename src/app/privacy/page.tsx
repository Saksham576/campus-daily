import Link from "next/link";

export const metadata = { title: "Privacy Policy — Campus Daily" };

export default function PrivacyPage() {
  return (
    <main id="main" className="wrap narrow">
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: 14 October 2026. Campus Daily is a student-run project at IIT Bombay.</p>

      <h2>What we collect</h2>
      <ul>
        <li>Your IITB email address (for login).</li>
        <li>Profile choices you give us: department, year, division, hostel, HASMED elective, interests, delivery preference.</li>
        <li>Optional: a personal email and your private Moodle calendar link.</li>
        <li>Your timetable entries and how you interact with notices (view, keep, dismiss, add to calendar).</li>
      </ul>

      <h2>Why we collect it</h2>
      <p>To show you the notices and timetable that matter to you, and to improve how notices are ranked. We do not sell your personal data.</p>

      <h2>Who processes it</h2>
      <p>Supabase (database and login), Vercel (hosting), and Google (Gemini) to score campus notices. Student data is not sent to Gemini; only the notice text is.</p>

      <h2>Your rights (DPDP Act, 2023)</h2>
      <p>
        In <Link href="/settings">Settings</Link> you can download all your data as a file and permanently delete your account
        and everything linked to it. You can also withdraw consent at any time by deleting your account.
      </p>

      <h2>Contact</h2>
      <p>Questions or grievances: 26b2477@iitb.ac.in</p>
    </main>
  );
}
