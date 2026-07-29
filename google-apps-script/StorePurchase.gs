/**
 * Luna Forms Portal — Store Purchase receiver.
 *
 * Setup:
 *   1. Open the target Google Sheet -> Extensions -> Apps Script.
 *   2. Paste this file, then set TOKEN below to a long random string.
 *   3. Run `setupSheet` once to write the header row.
 *   4. Deploy -> New deployment -> Web app.
 *        Execute as: Me
 *        Who has access: Anyone
 *   5. Copy the /exec URL into SHEETS_ENDPOINT, and the same TOKEN into
 *      SHEETS_TOKEN, in the portal's environment variables.
 *
 * "Anyone" access is required because Vercel posts unauthenticated — TOKEN is
 * what actually keeps strangers from writing rows, so treat it as a secret.
 */

var TOKEN = 'CHANGE-ME-TO-A-LONG-RANDOM-STRING';
var SHEET_NAME = 'StorePurchase';

// Must stay in sync with PRODUCTS in src/lib/forms/store-purchase.js.
var PRODUCTS = [
  'Coffee Beans', 'Sugar', 'Milk', 'Cups', 'Lids', 'Straws',
  'Napkins', 'Syrup', 'Cream', 'Tea', 'Other'
];

function headers_() {
  var head = [
    'Submitted At', 'Reference', 'Submitted By',
    'Transaction Type', 'Location', 'Entry Date'
  ];
  for (var i = 0; i < PRODUCTS.length; i++) {
    head.push(PRODUCTS[i] + ' — Unit');
    head.push(PRODUCTS[i] + ' — Count');
  }
  head.push('Remarks');
  return head;
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
  }
  if (sh.getLastRow() === 0) {
    var head = headers_();
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Run this once from the editor to create the tab and header row. */
function setupSheet() {
  sheet_();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ ok: true, service: 'luna-store-purchase' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'empty body' });
    }

    var body = JSON.parse(e.postData.contents);

    if (TOKEN && body.token !== TOKEN) {
      return json_({ ok: false, error: 'unauthorized' });
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);

    try {
      var sh = sheet_();

      // Collapse the products array into the wide Unit/Count column pairs.
      var unitFor = {};
      var countFor = {};
      var items = body.products || [];
      for (var i = 0; i < items.length; i++) {
        var name = items[i].name;
        if (!name) continue;
        // Repeated rows for the same product accumulate rather than overwrite.
        countFor[name] = (countFor[name] || 0) + Number(items[i].count || 0);
        unitFor[name] = items[i].unit || unitFor[name] || '';
      }

      var row = [
        body.submittedAt || new Date().toISOString(),
        body.ref || '',
        body.email || '',
        body.transactionType || '',
        body.location || '',
        body.date || ''
      ];

      for (var p = 0; p < PRODUCTS.length; p++) {
        var key = PRODUCTS[p];
        row.push(unitFor[key] || '');
        row.push(countFor[key] === undefined ? '' : countFor[key]);
      }

      row.push(body.remarks || '');

      sh.appendRow(row);
      return json_({ ok: true, ref: body.ref });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
