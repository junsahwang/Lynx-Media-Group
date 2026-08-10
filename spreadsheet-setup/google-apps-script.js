/**
 * Lynx site forms -> CRM tab
 *
 * Receives submissions from the site's forms and appends one row to the
 * single CRM tab. Calendly bookings land in the same tab via the separate
 * calendly-webhook.js project, so every lead — creator or brand — sits in
 * one list.
 *
 * The two scripts MUST agree on CRM_TAB_NAME and CRM_HEADERS below.
 * Change one, change the other.
 */

const SPREADSHEET_ID = "1j6vW_X6ETyKQXKYv8MfV1hk2JqjZeZoQjgwGBesJ2Fc";

// Simple site token — visible in the site's JS (nothing in a static site
// is secret), so this is NOT authentication. It exists to shed drive-by
// scanners and dumb spam bots that POST junk at every URL they find.
const REQUIRED_SOURCE = "lynx-site-v1";

// Global throttle: max submissions per rolling window across all
// visitors. Apps Script can't see IPs, so this caps abuse volume
// rather than per-user rates. Legit traffic never hits this.
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_SECONDS = 600; // 10 minutes

const MAX_PAYLOAD_BYTES = 10 * 1024;

/* ---- shared CRM schema (keep in sync with calendly-webhook.js) ---- */
const CRM_TAB_NAME = "CRM";
const CRM_HEADERS = [
  "Submitted At",
  "Type",
  "Name",
  "Email",
  "Website / Portfolio",
  "Details",
  "Budget",
  "Page",
  "Meeting Time"
];

/**
 * Each form maps its own fields into the shared column order. Blank
 * strings keep every row the same width, so sorting and filtering the
 * CRM never shears a row apart.
 */
const FORMS = {
  creator: {
    label: "Creator",
    row: function (data) {
      return [
        cell(data.creatorName, 120), // Name
        cell(data.portfolio, 300), // Website / Portfolio
        cell(data.experience, 2000), // Details
        "", // Budget — creators do not have one
        cell(data.page, 300), // Page
        "" // Meeting Time — no call is booked from this form
      ];
    }
  },
  // The site's business form was replaced by Calendly booking, so this
  // path is dormant; kept so any old cached page still records cleanly.
  business: {
    label: "Brand form",
    row: function (data) {
      return [
        cell(data.applicantName, 120),
        cell(data.companyWebsite, 300),
        "",
        cell(data.marketingBudget, 60),
        cell(data.page, 300),
        ""
      ];
    }
  }
};

function doGet() {
  return ContentService
    .createTextOutput("Lynx Media Group application endpoint is ready. [v9-crm]")
    .setMimeType(ContentService.MimeType.TEXT);
}

// Neutralize spreadsheet formula injection: a value starting with
// = + - @ or a tab/CR would otherwise be interpreted as a formula when
// the sheet is opened (a classic data-exfiltration vector). Prefixing
// with an apostrophe forces Sheets to store plain text.
function cell(value, max) {
  let text = String(value == null ? "" : value);
  text = text.replace(/[\u0000-\u001F\u007F]/g, "");
  text = text.slice(0, max);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return text;
}

function isValidEmail(value) {
  return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(String(value || ""));
}

function reject(reason) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: reason }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(event) {
  // payload size cap before any parsing
  if (!event || !event.postData || !event.postData.contents ||
      event.postData.contents.length > MAX_PAYLOAD_BYTES) {
    return reject("Invalid request.");
  }

  // global rate limit (best effort — shared across all visitors)
  const cache = CacheService.getScriptCache();
  const count = Number(cache.get("rl") || "0");
  if (count >= RATE_LIMIT_MAX) return reject("Too many requests. Please try again soon.");
  cache.put("rl", String(count + 1), RATE_LIMIT_WINDOW_SECONDS);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    let data;
    try {
      data = JSON.parse(event.postData.contents);
    } catch (parseError) {
      return reject("Invalid request.");
    }

    // shed drive-by scanners, and enforce the honeypot server-side too
    // (the site never sends submissions with the honeypot filled)
    if (data.source !== REQUIRED_SOURCE) return reject("Invalid request.");
    if (data.company_url_confirm) return reject("Invalid request.");

    const form = FORMS[data.applicationType];
    if (!form) return reject("Unknown application type.");
    if (!isValidEmail(data.email)) return reject("Please provide a valid email.");

    // only whitelisted fields are written — unknown keys are ignored
    const mapped = form.row(data);
    const row = [
      cell(data.submittedAt || new Date().toISOString(), 40), // Submitted At
      form.label, // Type
      mapped[0], // Name
      cell(data.email, 254), // Email
      mapped[1], // Website / Portfolio
      mapped[2], // Details
      mapped[3], // Budget
      mapped[4], // Page
      mapped[5] // Meeting Time
    ];

    getCrmSheet(SpreadsheetApp.openById(SPREADSHEET_ID)).appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    // never leak internal error details to callers
    return reject("Submission failed.");
  } finally {
    lock.releaseLock();
  }
}

function getCrmSheet(spreadsheet) {
  // name match is case- and whitespace-insensitive
  const wanted = CRM_TAB_NAME.trim().toLowerCase();
  let sheet = spreadsheet.getSheets().filter(function (s) {
    return s.getName().trim().toLowerCase() === wanted;
  })[0] || null;

  if (!sheet) sheet = spreadsheet.insertSheet(CRM_TAB_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CRM_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, CRM_HEADERS.length).setFontWeight("bold");
  }

  return sheet;
}
