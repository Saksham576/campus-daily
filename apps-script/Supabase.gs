/**
 * Google Apps Script Bridge for Campus Daily
 * Syncs scraped and scored notices into Supabase on a 10-minute trigger.
 */

var SUPABASE_URL = "https://bcqzlxftcsgjmgaddqjz.supabase.co";
// Set via Script Properties: PropertiesService.getScriptProperties().getProperty("SUPABASE_SERVICE_KEY")

function getSupabaseKey_() {
  var props = PropertiesService.getScriptProperties();
  return (
    props.getProperty("SUPABASE_SERVICE_KEY") ||
    props.getProperty("SUPABASE_KEY") ||
    ""
  );
}

function sbRequest_(endpoint, method, payload) {
  var url = SUPABASE_URL + "/rest/v1/" + endpoint;
  var key = getSupabaseKey_();
  if (!key) {
    Logger.log("Supabase key not configured; skipping sync.");
    return null;
  }

  var options = {
    method: method || "get",
    contentType: "application/json",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      Prefer: "resolution=merge-duplicates",
    },
    muteHttpExceptions: true,
  };

  if (payload) {
    options.payload = JSON.stringify(payload);
  }

  try {
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return response.getContentText() ? JSON.parse(response.getContentText()) : true;
    } else {
      Logger.log("Supabase error " + code + ": " + response.getContentText());
      return null;
    }
  } catch (e) {
    Logger.log("UrlFetchApp exception: " + e.toString());
    return null;
  }
}

function sbUpsert_(table, rows, onConflict) {
  if (!rows || rows.length === 0) return;
  var endpoint = table + (onConflict ? "?on_conflict=" + onConflict : "");
  return sbRequest_(endpoint, "post", rows);
}

/**
 * Pushes scored notice items to Supabase
 */
function pushItemsToSupabase(scoredItems) {
  if (!scoredItems || scoredItems.length === 0) return;

  var rows = scoredItems.map(function (item) {
    return {
      id: item.id || Utilities.getUuid(),
      subject: item.subject,
      from_address: item.from || item.sender,
      received_at: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
      score: item.score || 0,
      summary: item.summary || "",
      body: item.body || "",
      links: JSON.stringify(item.links || []),
      tags: item.tags || [],
      is_personal: Boolean(item.is_personal),
      target_departments: item.target_departments || [],
      target_years: item.target_years || [],
      target_hostels: item.target_hostels || [],
    };
  });

  sbUpsert_("items", rows, "id");
}

/**
 * Syncs Google Sheet subscribers to Supabase
 */
function syncSubscribersToSupabase(subscribersList) {
  if (!subscribersList || subscribersList.length === 0) return;

  var subRows = subscribersList
    .filter(function (s) {
      return s.email && s.email.trim();
    })
    .map(function (s) {
      return {
        email: s.email.trim().toLowerCase(),
        department: s.department || null,
        year: s.year || null,
        division: s.division || null,
        hostel: s.hostel || null,
        hasmed: s.hasmed || null,
        categories: s.categories || [],
        personal_email: s.personal_email ? s.personal_email.trim().toLowerCase() : null,
        delivery_preference: s.delivery_preference || "app",
        updated_at: new Date().toISOString(),
      };
    });

  sbUpsert_("subscribers", subRows, "email");
}
