/**
 * Campus Daily — free email ingestion (no paid services).
 *
 * Runs on a dedicated free Gmail account (e.g. campusdaily.ingest@gmail.com) that receives
 * IITB mailing-list mail via a webmail auto-forward rule. Every 10 minutes it sends new
 * mail to Campus Daily, which scores it, updates timetables and alerts students.
 *
 * Setup (once):
 *  1. script.google.com → New project (signed in as the ingest Gmail) → paste this file.
 *  2. Project Settings → Script properties → add INGEST_SECRET_KEY (same value as in Vercel).
 *  3. Run installTrigger() once and allow the permissions.
 */
var INGEST_URL = "https://campusdaily.nexuspulsetech.com/api/ingest/email";
var DONE_LABEL = "campus-daily/sent";

function forwardNewMail() {
  var secret = PropertiesService.getScriptProperties().getProperty("INGEST_SECRET_KEY");
  if (!secret) throw new Error("Set INGEST_SECRET_KEY in Script properties.");
  var done = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);

  var threads = GmailApp.search("in:inbox -label:" + DONE_LABEL.replace("/", "-") + " newer_than:3d", 0, 30);
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
        headers: { "x-ingest-secret": secret },
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
}
