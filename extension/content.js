// Lets Campus Daily know the extension is installed, so it can offer one-click Connect Moodle.
// Several signals, because the page can rewrite <html> attributes while it loads.
const VERSION = chrome.runtime.getManifest().version;
const mark = () => {
  try {
    document.documentElement.dataset.cdConnect = VERSION;
  } catch {}
};
mark();
document.addEventListener("DOMContentLoaded", mark);
window.addEventListener("load", mark);
// The page asks "are you there?" and we answer.
window.addEventListener("message", (e) => {
  if (e.source === window && e.data && e.data.type === "cd-connect-ping") {
    window.postMessage({ type: "cd-connect-pong", version: VERSION }, window.location.origin);
  }
});
window.postMessage({ type: "cd-connect-pong", version: VERSION }, window.location.origin);
