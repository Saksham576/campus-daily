import { Logo } from "@/components/Logo";

/** Sign-in header: the mark, the name, one line on what it does. */
export function StationSign() {
  return (
    <div className="station-sign">
      <Logo />
      <span className="ss-en">Campus Daily</span>
      <span className="ss-foot">Your IIT Bombay notices, timetable and Moodle — in one place.</span>
    </div>
  );
}
