/**
 * Calendly -> CRM sheet
 *
 * Receives Calendly's `invitee.created` webhook and appends one row per
 * booking to the business tab, so every intro call lands in the same
 * sheet as everything else.
 *
 * DEPLOY
 *  1. Open the Apps Script project bound to the CRM spreadsheet
 *     (Extensions -> Apps Script), add this file.
 *  2. Deploy -> New deployment -> Web app.
 *       Execute as: Me
 *       Who has access: Anyone
 *     Copy the /exec URL.
 *  3. Register the webhook with Calendly (needs a plan that includes
 *     webhooks — Standard or higher at time of writing). From a terminal,
 *     with a personal access token from calendly.com/integrations/api_webhooks:
 *
 *     curl -X POST https://api.calendly.com/webhook_subscriptions \
 *       -H "Authorization: Bearer YOUR_CALENDLY_TOKEN" \
 *       -H "Content-Type: application/json" \
 *       -d '{
 *             "url": "YOUR_EXEC_URL?token=SHARED_SECRET",
 *             "events": ["invitee.created"],
 *             "organization": "YOUR_ORGANIZATION_URI",
 *             "scope": "organization"
 *           }'
 *
 *     (Get organization URI from: curl https://api.calendly.com/users/me
 *      -H "Authorization: Bearer YOUR_CALENDLY_TOKEN")
 *  4. Book a test slot on your own link and confirm a row appears.
 */

const CRM_SPREADSHEET_ID = "1j6vW_X6ETyKQXKYv8MfV1hk2JqjZeZoQjgwGBesJ2Fc";
const CRM_TAB_NAME = "business web app";

// Anyone who learns the /exec URL could POST to it, so require a secret in
// the query string. Set this to a long random string and use the same one
// in the webhook URL above.
const WEBHOOK_SECRET = "CHANGE_ME_TO_A_LONG_RANDOM_STRING";

const CRM_HEADERS = [
  "Submitted At",
  "Name",
  "Email",
  "Company Website",
  "Challenge",
  "Budget",
  "Page",
  "Meeting Time"
];

/**
 * Calendly labels answers by the question text you typed, so match on a
 * distinctive fragment rather than the whole string — that way small
 * wording edits in Calendly don't silently break the mapping.
 */
const QUESTION_MATCHES = {
  website: ["website", "company"],
  challenge: ["challenge", "problem", "goal"],
  budget: ["budget"]
};

function findAnswer(pairs, keys) {
  for (const pair of pairs) {
    const question = String(pair.question || "").toLowerCase();
    if (keys.some((key) => question.indexOf(key) !== -1)) {
      // checkbox answers arrive as an array
      return Array.isArray(pair.answer) ? pair.answer.join(", ") : pair.answer;
    }
  }
  return "";
}

// A value starting with = + - @ is treated as a formula by Sheets, which is
// a classic exfiltration trick. Prefix it so it stays plain text.
function crmCell(value, max) {
  let text = String(value == null ? "" : value);
  text = text.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max || 500);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return text;
}

function crmSheet(spreadsheet) {
  const wanted = CRM_TAB_NAME.trim().toLowerCase();
  let sheet =
    spreadsheet.getSheets().filter(function (s) {
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

function doPost(event) {
  // reject anything without the shared secret
  if (!event || !event.parameter || event.parameter.token !== WEBHOOK_SECRET) {
    return ContentService.createTextOutput("no").setMimeType(
      ContentService.MimeType.TEXT
    );
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const body = JSON.parse(event.postData.contents);
    if (body.event !== "invitee.created") {
      return ContentService.createTextOutput("ignored").setMimeType(
        ContentService.MimeType.TEXT
      );
    }

    const p = body.payload || {};
    const answers = p.questions_and_answers || [];
    const tracking = p.tracking || {};
    const scheduled = p.scheduled_event || {};

    const row = [
      crmCell(new Date(p.created_at || Date.now()).toLocaleString("en-US"), 40),
      crmCell(p.name, 120),
      crmCell(p.email, 254),
      crmCell(findAnswer(answers, QUESTION_MATCHES.website), 300),
      crmCell(findAnswer(answers, QUESTION_MATCHES.challenge), 1000),
      crmCell(findAnswer(answers, QUESTION_MATCHES.budget), 60),
      // utm_content is stamped by the site's booking links, so this says
      // which page sent them; fall back to the raw source
      crmCell(tracking.utm_content || tracking.utm_source || "direct", 120),
      crmCell(
        scheduled.start_time
          ? new Date(scheduled.start_time).toLocaleString("en-US")
          : "",
        40
      )
    ];

    crmSheet(SpreadsheetApp.openById(CRM_SPREADSHEET_ID)).appendRow(row);

    return ContentService.createTextOutput("ok").setMimeType(
      ContentService.MimeType.TEXT
    );
  } catch (error) {
    // Calendly retries on failure, so surface an error rather than "ok"
    return ContentService.createTextOutput("error").setMimeType(
      ContentService.MimeType.TEXT
    );
  } finally {
    lock.releaseLock();
  }
}
