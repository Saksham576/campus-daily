/**
 * Campus Daily — free email ingestion (no paid services, no shared secret).
 *
 * Runs on campusdaily.ingest@gmail.com, which receives students' IITB mail via webmail forwarding
 * rules (each student forwards to campusdaily.ingest+<their token>@gmail.com — see Settings → IITB mail).
 * Every 10 minutes it sends new inbox mail to Campus Daily with:
 *   - the headers that say whose forward it is and whether it's list mail (Delivered-To, To, Cc, List-Id),
 *   - document attachments (PDF, Word, PowerPoint, Excel), uploaded straight to private storage.
 * It authenticates with this account's Google ID token; the server only accepts this account.
 *
 * Setup (once): paste this file + appsscript.json, then run installTrigger() and allow access.
 */
var APP = "https://campusdaily.nexuspulsetech.com";
var INGEST_URL = APP + "/api/ingest/email";
var UPLOAD_URL = APP + "/api/ingest/upload-url";
var DONE_LABEL = "campus-daily-sent";
var DOC_RE = /\.(pdf|docx|pptx|xlsx|txt|csv)$/i;
var MAX_BYTES = 25 * 1024 * 1024;

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
        to: msg.getTo(),
        cc: msg.getCc(),
        listId: msg.getHeader("List-Id"),
        deliveredTo: msg.getHeader("Delivered-To"),
        attachments: uploadAttachments(msg, token),
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

/** Documents attached to a mail → private Campus Daily storage. Returns [{path, name, mime}]. */
function uploadAttachments(msg, token) {
  var out = [];
  msg.getAttachments({ includeInlineImages: false }).forEach(function (a) {
    var name = a.getName() || "";
    if (!DOC_RE.test(name) || a.getSize() > MAX_BYTES || out.length >= 10) return;
    try {
      var link = UrlFetchApp.fetch(UPLOAD_URL, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + token },
        payload: JSON.stringify({ name: name, mime: a.getContentType(), size: a.getSize() }),
        muteHttpExceptions: true,
      });
      if (link.getResponseCode() !== 200) return;
      var j = JSON.parse(link.getContentText());
      var put = UrlFetchApp.fetch(j.url, {
        method: "put",
        contentType: a.getContentType() || "application/octet-stream",
        payload: a.copyBlob().getBytes(),
        muteHttpExceptions: true,
      });
      if (put.getResponseCode() === 200) out.push({ path: j.path, name: name, mime: a.getContentType() });
    } catch (e) {
      Logger.log("Attachment upload failed: " + name + " " + e);
    }
  });
  return out;
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "forwardNewMail") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("forwardNewMail").timeBased().everyMinutes(10).create();
  forwardNewMail();
}
