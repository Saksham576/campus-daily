import assert from "node:assert";
import { htmlToText, parseWebItems, webItemToEmail, istWords, buildExtractPrompt } from "./src/lib/webPages.ts";
import { extractEventDetails } from "./src/lib/events.ts";
import { privateMailReason } from "./src/lib/ingest.ts";
import { senderName } from "./src/lib/display.ts";

console.log("Web page reader tests...");
const html = `<html><head><script>var x=1</script></head><body><nav><a href="/menu">Menu</a></nav>
<main><h2>Announcements</h2><ul><li><a href="/apply-now">Applications invited for UCEED</a> <span>Last date: 20 Oct</span></li>
<li><a href="https://acad.iitb.ac.in/circ.pdf">Registration circular</a></li><li><a href="mailto:a@b.c">mail</a></li></ul></main><footer>Contact</footer></body></html>`;
const text = htmlToText(html, "https://www.iitb.ac.in/announcements");
assert.ok(text.includes("Applications invited for UCEED (https://www.iitb.ac.in/apply-now)"), "links resolved against the page");
assert.ok(!/Menu|Contact|var x/.test(text), "menus, footers and scripts dropped");

const items = parseWebItems(JSON.stringify({ items: [
  { title: "Open House 2026", summary: "Campus open house.", when: "2026-10-24T10:00:00+05:30", venue: "Main Building", url: "https://www.iitb.ac.in/open-house" },
  { title: "", summary: "no title" },
  { title: "Bad date", when: "someday", url: "javascript:alert(1)" },
] }));
assert.strictEqual(items.length, 2);
assert.strictEqual(items[1].when, null, "unparseable dates become null");
assert.strictEqual(items[1].url, null, "only http(s) links kept");
assert.deepStrictEqual(parseWebItems("not json"), []);

assert.strictEqual(istWords("2026-10-24T04:30:00Z"), "24 October 2026, 10:00 AM");
const mail = webItemToEmail("IIT Bombay · Announcements", "https://www.iitb.ac.in/announcements", items[0], new Date("2026-10-20T00:00:00Z"));
assert.strictEqual(mail.from, "Web: IIT Bombay · Announcements");
assert.strictEqual(privateMailReason(mail), null, "official web pages are not 'non-IITB mail'");
assert.strictEqual(senderName(mail.from), "IIT Bombay · Announcements");
const ev = extractEventDetails(mail.subject, mail.body);
assert.ok(ev && new Date(ev.start_time).toISOString() === "2026-10-24T04:30:00.000Z", "date written in the body is read as the event time");
assert.ok(buildExtractPrompt("x", "https://x", "hello").includes("untrusted"));
console.log("✓ Passed: pages become text, replies are validated, items become notices");
