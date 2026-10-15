/**
 * Campus Daily — free email ingestion (no paid services, no shared secret).
 *
 * Runs on campusdaily.ingest@gmail.com, which receives IITB mailing-list mail via a webmail
 * auto-forward rule. Every 10 minutes it sends new inbox mail to Campus Daily, which scores it,
 * updates timetables and alerts students. It authenticates with this account's Google ID token;
 * the server only accepts tokens for campusdaily.ingest@gmail.com.
 *
 * Setup (once): paste this file + appsscript.json, then run installTrigger() and allow access.
 */
var INGEST_URL = "https://campusdaily.nexuspulsetech.com/api/ingest/email";
var DONE_LABEL = "campus-daily-sent";

function forwardNewMail() {
  var done = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  var token = ScriptApp.getIdentityToken();

  // Skip Gmail's own system mail; only forwarded campus mail is wanted.
  var threads = GmailApp.search("in:inbox -label:" + DONE_LABEL + " -from:google.com -from:accounts.google.com newer_than:3d", 0, 30);
  threads.forEach(function (thread) {
    var allOk = true;
    thread.getMessages().forEach(function (msg) {
      var payload = {
        messageId: msg.getHeader("Message-ID") || msg.getId(),
        subject: msg.getSubject(),
        from: msg.getFrom(),
        date: msg.getDate().toISOString(),
        text: msg.getPlainBody().slice(0, 20000),
      };
      var res = UrlFetchApp.fetch(INGEST_URL, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + token },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
      var code = res.getResponseCode();
      // 200 = stored, 400/422 = nothing usable (don't retry); anything else retries next run.
      if (code !== 200 && code !== 400 && code !== 422) {
        allOk = false;
        Logger.log("Ingest failed " + code + " for: " + payload.subject);
      }
    });
    if (allOk) thread.addLabel(done);
  });
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "forwardNewMail") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("forwardNewMail").timeBased().everyMinutes(10).create();
  forwardNewMail();
}
