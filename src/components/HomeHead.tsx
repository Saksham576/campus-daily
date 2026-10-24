import { greeting } from "@/lib/display";
import { Fresh } from "@/components/Fresh";

type Dated = { when?: string | null; subject: string; myCourse?: string | null };

const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** Greeting plus a one-line briefing: what's due soon and the next exam. */
export function HomeHead({ name, now, action, exams }: { name?: string | null; now: Date; action: Dated[]; exams: Dated[] }) {
  const first = (name || "").split(" ")[0];
  const dateLine = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
  const week = now.getTime() + 7 * 86400_000;
  const dueSoon = action.filter((a) => a.when && new Date(a.when).getTime() <= week).length;
  const nextExam = exams.find((e) => e.when);

  const bits: React.ReactNode[] = [];
  if (dueSoon) bits.push(<span key="d" className="brief-due">{dueSoon} due this week</span>);
  if (nextExam?.when)
    bits.push(
      <span key="e">
        Next exam: <b>{nextExam.myCourse || "Quiz"}</b> · {shortDay(nextExam.when)}
      </span>
    );
  if (!bits.length) bits.push(<span key="c">Nothing due this week.</span>);

  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{dateLine}</p>
        <h1>
          {greeting(now)}
          {first ? `, ${first}` : ""}
        </h1>
        <Fresh at={now.toISOString()} />
        <p className="brief">{bits.reduce<React.ReactNode[]>((acc, b, i) => (i ? [...acc, <span key={`s${i}`} className="brief-sep">·</span>, b] : [b]), [])}</p>
      </div>
    </div>
  );
}
