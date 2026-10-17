import assert from "node:assert";
import { forwardAddress, forwardToken, isPersonalMail, newForwardToken } from "./src/lib/forwarding.ts";

console.log("Webmail forwarding tests...");
assert.strictEqual(forwardAddress("k7f2qabcde"), "campusdaily.ingest+k7f2qabcde@gmail.com");
assert.strictEqual(forwardToken({ deliveredTo: "campusdaily.ingest+K7F2QABCDE@gmail.com" }), "k7f2qabcde");
assert.strictEqual(forwardToken({ deliveredTo: "campusdaily.ingest@gmail.com", to: "student-notices@iitb.ac.in" }), null);
const t = newForwardToken();
assert.match(t, /^[a-z2-9]{10}$/);
// list mail is shared; direct mail is personal
assert.strictEqual(isPersonalMail({ listId: "<student-notices.iitb.ac.in>", to: "student-notices@iitb.ac.in" }, "26b2477@iitb.ac.in"), false);
assert.strictEqual(isPersonalMail({ to: "26B2477@iitb.ac.in" }, "26b2477@iitb.ac.in"), true);
assert.strictEqual(isPersonalMail({ to: "undisclosed-recipients:;" }, "26b2477@iitb.ac.in"), false);
assert.strictEqual(isPersonalMail({ to: "undisclosed-recipients:;" }, "26b2477@iitb.ac.in", true), true, "scorer says it's for one person");
console.log("✓ Passed: forwarding addresses, owners and personal-mail detection");
