/**
 * OPUS upload bridge — paste into the MASTER sheet: Extensions → Apps Script.
 * Lets the upload page read MASTER and write reviewed rows without a Google Cloud client ID.
 * Setup: see README, section "Option A".
 *
 * Runs as the person who deploys it. Anyone with the web-app URL AND the access key can write,
 * so share both only with the team. Every write is logged in the "Upload log" tab.
 */
const LOG_TAB = 'Upload log';

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const key = PropertiesService.getScriptProperties().getProperty('KEY');
    if (!key) return out_({ error: 'No KEY set in the script properties (Project Settings → Script properties).' });
    if (req.key !== key) return out_({ error: 'Wrong access key.' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (req.action === 'read') {
      const sheets = {};
      req.tabs.forEach(t => {
        const sh = ss.getSheetByName(t);
        sheets[t] = sh ? sh.getDataRange().getDisplayValues() : [];
      });
      return out_({ sheets, title: ss.getName() });
    }

    if (req.action === 'formulas') {
      const sh = ss.getSheetByName(req.tab);
      return out_({ formulas: sh.getRange(req.row, 1, 1, Math.min(sh.getMaxColumns(), 60)).getFormulas()[0] });
    }

    if (req.action === 'write') {
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        // Literal values: format as text first, so "1605-08-18" stays a string and is not turned into a date.
        req.raw.forEach(o => ss.getRange(o.range).setNumberFormat('@').setValues(o.values));
        req.formulas.forEach(o => ss.getRange(o.range).setFormulas(o.values));
        const log = ss.getSheetByName(LOG_TAB) || ss.insertSheet(LOG_TAB).appendRow(['time', 'who', 'letter', 'changes']);
        log.appendRow([new Date(), req.who || '', req.letter || '', req.summary.join('\n')]);
        SpreadsheetApp.flush();
      } finally {
        lock.releaseLock();
      }
      return out_({ ok: true });
    }
    return out_({ error: 'Unknown action.' });
  } catch (err) {
    return out_({ error: String(err && err.message || err) });
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
