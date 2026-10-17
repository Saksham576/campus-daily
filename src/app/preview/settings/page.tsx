"use client";

import { AppBar } from "@/components/AppBar";
import { Panel, SettingsRail, ThemePicker } from "@/components/SettingsLayout";
import { CATEGORIES } from "@/lib/constants";

/** Dev-only: the Settings layout with sample values. */
export default function PreviewSettings() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <>
      <AppBar />
      <main className="wrap">
        <div className="page-head">
          <div>
            <p className="eyebrow">26b2477@iitb.ac.in</p>
            <h1>Settings</h1>
          </div>
        </div>
        <div className="settings">
          <SettingsRail />
          <form className="panels" onSubmit={(e) => e.preventDefault()}>
            <Panel id="profile" title="Profile" sub="Used to pick notices meant for you — department, year and hostel.">
              <div className="row2">
                <label className="field">
                  Department
                  <select defaultValue="MEMS">
                    <option>MEMS</option>
                  </select>
                </label>
                <label className="field">
                  Program year
                  <select defaultValue="1">
                    <option value="1">Year 1</option>
                  </select>
                </label>
              </div>
            </Panel>
            <Panel id="courses" title="My courses" sub="Your timetable is built from these.">
              <div className="list-row">
                <span>
                  <b>MA 105</b> Calculus · D3
                </span>
                <button type="button" className="ghost">Remove</button>
              </div>
              <div className="list-row">
                <span>
                  <b>CH 111</b> Chemistry · D3
                </span>
                <button type="button" className="ghost">Remove</button>
              </div>
            </Panel>
            <Panel id="moodle" title="Moodle" sub="Announcements, slides and seating plans from your courses.">
              <div className="list-row">
                <span>
                  <b>Connected</b> as Saksham Tiwari
                  <br />
                  <span className="help">Last read 17 Oct, 2:30 pm</span>
                </span>
                <button type="button">Disconnect</button>
              </div>
            </Panel>
            <Panel id="interests" title="Interests" sub="Topics you care about rank higher.">
              <div className="chips">
                {CATEGORIES.map((c, i) => (
                  <span key={c} className={`chip ${i < 3 ? "on" : ""}`}>
                    {c}
                  </span>
                ))}
              </div>
              <label className="field">
                Keywords
                <input type="text" defaultValue="AI/ML, robotics, techfest" />
                <span className="help">Comma-separated.</span>
              </label>
            </Panel>
            <Panel id="delivery" title="Delivery" sub="Where you want your notices.">
              <label className="choice">
                <input type="radio" name="d" defaultChecked />
                <span>
                  <b>Board + evening email</b>
                  <br />
                  <span className="help">Both.</span>
                </span>
              </label>
            </Panel>
            <Panel id="alerts" title="Alerts & calendar" sub="Phone alerts and a live calendar link.">
              <div className="list-row">
                <span>Phone alerts are on</span>
                <button type="button">Turn off</button>
              </div>
            </Panel>
            <Panel id="appearance" title="Appearance" sub="Light or dark. You can also switch from the sidebar.">
              <ThemePicker />
            </Panel>
            <Panel id="privacy" title="Data & privacy" sub="Download everything we store about you, or delete your account.">
              <div className="list-row">
                <span>Sign out of this device</span>
                <button type="button">Sign out</button>
              </div>
              <div className="list-row">
                <span>
                  <b>Delete my account</b>
                  <br />
                  <span className="help">Removes your profile, courses and Moodle connection for good.</span>
                </span>
                <button type="button" className="danger">Delete</button>
              </div>
            </Panel>
            <div className="save-bar">
              <span>Profile, interests and delivery save together.</span>
              <button type="submit" className="primary">Save</button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
