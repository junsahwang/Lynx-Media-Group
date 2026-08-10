/**
 * Lynx Media Group — one Apps Script, two inputs, one spreadsheet.
 *
 *   site forms  -> "creator web app" tab   (creator applications)
 *   Calendly    -> "business web app" tab  (booked intro calls)
 *
 * Both arrive as POSTs to the SAME /exec URL. They are told apart by the
 * shared secret in the query string: Calendly's subscription includes
 * ?token=..., the website never does. That is why this file replaces the
 * two older scripts — a project can only define doPost once, so keeping
 * them separate meant one silently overwriting the other.
 *
 * DEPLOY
 *  1. Paste this whole file into the existing Apps Script project,
 *     replacing everything there.
 *  2. Set WEBHOOK_SECRET below to a long URL-safe string (letters and
 *     digits only — no ; / ? & # or spaces).
 *  3. Deploy -> Manage deployments -> pencil icon -> Version: New version
 *     -> Deploy. Keep the same /exec URL so the website keeps working.
 *  4. Register that URL with Calendly (see register-calendly-webhook.sh).
 */

const SPREADSHEET_ID = "1j6vW_X6ETyKQXKYv8MfV1hk2JqjZeZoQjgwGBesJ2Fc";

/* ---------- website form settings ---------- */

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

const SHEETS = {
  business: {
    // routes to the business tab (matched by gid, so renaming the tab
    // is safe); falls back to matching/creating a tab by name
    gid: 1647757159,
    name: "business web app",
    headers: ["Submitted At", "Name", "Email", "Company Website", "Challenge", "Budget", "Page"],
    fields: [
      { key: "applicantName", max: 120 },
      { key: "email", max: 254 },
      { key: "companyWebsite", max: 300 },
      { key: "challenge", max: 1000 },
      { key: "marketingBudget", max: 60 },
      { key: "page", max: 300 }
    ]
  },
  creator: {
    name: "creator web app",
    headers: ["Submitted At", "Creator Name", "Email", "Portfolio", "Experience", "Page"],
    fields: [
      { key: "creatorName", max: 120 },
      { key: "email", max: 254 },
      { key: "portfolio", max: 300 },
      { key: "experience", max: 2000 },
      { key: "page", max: 300 }
    ]
  }
};

/* ---------- Calendly settings ---------- */

// Must match the ?token=... on the webhook subscription. Anyone who
// learns the /exec URL could POST to it, so this is what separates a
// real Calendly delivery from a stranger.
const WEBHOOK_SECRET = "CHANGE_ME_letters_and_digits_only";

// Calendly labels answers by the question text you typed, so match on a
// distinctive fragment rather than the whole string — that way small
// wording edits in Calendly don't silently break the mapping.
const QUESTION_MATCHES = {
  website: ["website", "company"],
  challenge: ["challenge", "problem", "goal"],
  budget: ["budget"]
};

/* ---------- shared helpers ---------- */

function doGet() {
  return ContentService
    .createTextOutput("Lynx Media Group endpoint is ready. [v10-forms+calendly]")
    .setMimeType(ContentService.MimeType.TEXT);
}

// Neutralize spreadsheet formula injection: a value starting with
// = + - @ or a tab/CR would otherwise be interpreted as a formula when
// the sheet is opened (a classic data-exfiltration vector). Prefixing
// with an apostrophe forces Sheets to store plain text.
function sanitizeCell(value, max) {
  let text = String(value == null ? "" : value);
  text = text.replace(/[\u0000-\u001F\u007F]/g, "");
  text = text.slice(0, max || 500);
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

function text(value) {
  return ContentService.createTextOutput(value).setMimeType(ContentService.MimeType.TEXT);
}

function getOrCreateSheet(spreadsheet, config) {
  let sheet = null;

  // prefer lookup by tab id (gid) — immune to tab renames
  if (config.gid) {
    sheet = spreadsheet.getSheets().filter(function (s) {
      return s.getSheetId() === config.gid;
    })[0] || null;
  }

  // name match is case- and whitespace-insensitive
  if (!sheet) {
    const wanted = config.name.trim().toLowerCase();
    sheet = spreadsheet.getSheets().filter(function (s) {
      return s.getName().trim().toLowerCase() === wanted;
    })[0] || null;
  }

  if (!sheet) sheet = spreadsheet.insertSheet(config.name);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(config.headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, config.headers.length).setFontWeight("bold");
  }

  return sheet;
}

/* ---------- entry point ---------- */

function doPost(event) {
  // Calendly deliveries carry the shared secret; the website never does
  const isCalendly =
    event && event.parameter && event.parameter.token === WEBHOOK_SECRET;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return isCalendly ? handleCalendly(event) : handleSiteForm(event);
  } catch (error) {
    // never leak internal error details to callers
    return isCalendly ? text("error") : reject("Submission failed.");
  } finally {
    lock.releaseLock();
  }
}

/* ---------- website forms ---------- */

function handleSiteForm(event) {
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

  const config = SHEETS[data.applicationType];
  if (!config) return reject("Unknown application type.");
  if (!isValidEmail(data.email)) return reject("Please provide a valid email.");

  // only whitelisted fields are written — unknown keys are ignored
  const row = [sanitizeCell(data.submittedAt || new Date().toISOString(), 40)];
  config.fields.forEach(function (field) {
    row.push(sanitizeCell(data[field.key], field.max));
  });

  getOrCreateSheet(SpreadsheetApp.openById(SPREADSHEET_ID), config).appendRow(row);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Calendly bookings ---------- */

function findAnswer(pairs, keys) {
  for (const pair of pairs) {
    const question = String(pair.question || "").toLowerCase();
    if (keys.some(function (key) { return question.indexOf(key) !== -1; })) {
      // checkbox answers arrive as an array
      return Array.isArray(pair.answer) ? pair.answer.join(", ") : pair.answer;
    }
  }
  return "";
}

function handleCalendly(event) {
  if (!event.postData || !event.postData.contents) return text("no body");

  const body = JSON.parse(event.postData.contents);
  if (body.event !== "invitee.created") return text("ignored");

  const p = body.payload || {};
  const answers = p.questions_and_answers || [];
  const tracking = p.tracking || {};

  const row = [
    sanitizeCell(new Date(p.created_at || Date.now()).toLocaleString("en-US"), 40),
    sanitizeCell(p.name, 120),
    sanitizeCell(p.email, 254),
    sanitizeCell(findAnswer(answers, QUESTION_MATCHES.website), 300),
    sanitizeCell(findAnswer(answers, QUESTION_MATCHES.challenge), 1000),
    sanitizeCell(findAnswer(answers, QUESTION_MATCHES.budget), 60),
    // utm_content is stamped by the site's booking links, so this says
    // which page sent them; fall back to the raw source
    sanitizeCell(tracking.utm_content || tracking.utm_source || "direct", 120)
  ];

  getOrCreateSheet(SpreadsheetApp.openById(SPREADSHEET_ID), SHEETS.business).appendRow(row);

  return text("ok");
}
