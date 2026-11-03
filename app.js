import * as core from './core.js';

const cfg = window.OPUS_CONFIG;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const status = (id, msg, kind = '') => { $(id).className = `status ${kind}`; $(id).innerHTML = msg; };

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TABS = [core.LETTERS, ...core.KINDS.flatMap(k => [k.catalogTab, k.formsTab])];
const RANGES = { [core.LETTERS]: 'A:AV', People: 'A:B', Places: 'A:B', 'Political entities': 'A:B' };

// source: {kind:'google', id} | {kind:'file', sheets, formulaAt(col,row)}
let source = null, result = null, master = null, review = null;

try { $('master-url').value = localStorage.getItem('opus.masterUrl') || cfg.masterUrl; } catch { $('master-url').value = cfg.masterUrl; }

/* ---------- Google ---------- */
let token = null, tokenExpiry = 0;
function getToken() {
  if (token && Date.now() < tokenExpiry) return Promise.resolve(token);
  if (!cfg.clientId) return Promise.reject(new Error('No Google client ID in config.js (see README).'));
  if (!window.google?.accounts?.oauth2) return Promise.reject(new Error('Google sign-in did not load; check your connection or blockers.'));
  return new Promise((resolve, reject) => {
    google.accounts.oauth2.initTokenClient({
      client_id: cfg.clientId, scope: SCOPE,
      callback: r => r.error ? reject(new Error(r.error_description || r.error))
        : (token = r.access_token, tokenExpiry = Date.now() + (r.expires_in - 60) * 1000, resolve(token)),
      error_callback: e => reject(new Error(e.message || e.type)),
    }).requestAccessToken();
  });
}

async function api(path, opts = {}) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${source.id}${path}`, {
    ...opts, headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = body.error?.message || r.statusText;
    if (/not supported for this document/i.test(m))
      throw new Error('This link points to an Excel file stored in Drive, not a Google Sheet. Open it and use File → Save as Google Sheets, then paste the new link.');
    throw new Error(m);
  }
  return body;
}

const q = s => encodeURIComponent(s);
const rangeOf = t => `'${t}'!${RANGES[t] || 'A:D'}`;

/* ---------- loading MASTER ---------- */
async function readMaster() {
  if (source.kind === 'file') return source.sheets;
  const r = await api(`/values:batchGet?${TABS.map(t => `ranges=${q(rangeOf(t))}`).join('&')}`);
  return Object.fromEntries(TABS.map((t, i) => [t, r.valueRanges[i].values || []]));
}

async function formulaCols(sheets, letterId) {
  const i = (sheets[core.LETTERS] || []).findIndex(r => core.clean(r[0]) === letterId);
  if (i < 1) return new Set();
  const row = i + 1;
  if (source.kind === 'file') {
    return new Set(Array.from({ length: 48 }, (_, c) => core.colLetter(c)).filter(c => source.formulaAt(c, row)));
  }
  const r = await api(`/values/${q(`'${core.LETTERS}'!A${row}:AV${row}`)}?valueRenderOption=FORMULA`);
  return new Set((r.values?.[0] || []).map((v, c) => String(v).startsWith('=') ? core.colLetter(c) : null).filter(Boolean));
}

async function loadMasterFor(letterId) {
  const sheets = await readMaster();
  return core.indexMaster(sheets, letterId, await formulaCols(sheets, letterId));
}

async function connect(newSource, label) {
  source = newSource;
  status('master-status', 'Loading…');
  try {
    const sheets = await readMaster();
    const missing = TABS.filter(t => !sheets[t]?.length);
    if (missing.length) throw new Error(`Missing tabs: ${missing.join(', ')}`);
    const n = sheets[core.LETTERS].length - 1;
    status('master-status', `${label}: ${n} rows in ${esc(core.LETTERS)}.` +
      (source.kind === 'file' ? ' <b>Test mode: nothing can be written.</b>' : ''), 'ok');
    $('result-file').disabled = false;
    if (result) await startReview();
  } catch (e) {
    source = null;
    status('master-status', esc(e.message), 'err');
  }
}

$('btn-google').onclick = () => {
  const url = $('master-url').value.trim();
  const id = url.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (!id) return status('master-status', 'Paste a Google Sheets link (…/spreadsheets/d/…).', 'err');
  try { localStorage.setItem('opus.masterUrl', url); } catch {}
  connect({ kind: 'google', id, url }, 'Connected to Google Sheet');
};

const readXlsx = async file => {
  const wb = XLSX.read(await file.arrayBuffer(), { cellFormula: true });
  const sheets = Object.fromEntries(wb.SheetNames.map(n =>
    [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' })]));
  return { wb, sheets };
};

$('master-file').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  const { wb, sheets } = await readXlsx(file);
  const ws = wb.Sheets[core.LETTERS];
  connect({ kind: 'file', sheets, formulaAt: (c, r) => Boolean(ws?.[`${c}${r}`]?.f) }, `Local file ${esc(file.name)}`);
};

$('result-file').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  result = core.parseResult((await readXlsx(file)).sheets);
  if (result.errors.length) {
    status('result-status', `Cannot use this file:<br>${result.errors.map(esc).join('<br>')}`, 'err');
    $('s-review').hidden = $('s-plan').hidden = true;
    return;
  }
  await startReview();
};

async function startReview() {
  try {
    master = await loadMasterFor(result.letterId);
    if (!master.letterRow) throw new Error(`Letter ${result.letterId} is not in MASTER.`);
    review = core.buildReview(master, result);
    status('result-status', `Letter <b>${esc(result.letterId)}</b> (MASTER row ${master.letterRow}).`, 'ok');
    $('s-review').hidden = $('s-plan').hidden = false;
    render();
  } catch (e) {
    status('result-status', esc(e.message), 'err');
  }
}

/* ---------- review UI ---------- */
const check = (path, on, disabled = false) =>
  `<input type="checkbox" data-path="${path}" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''}>`;
const text = (path, v, cls = '') => `<input type="text" class="${cls}" data-path="${path}" value="${esc(v)}">`;

function fieldsTable() {
  const rows = review.fields.map((f, i) => {
    const diff = f.proposed !== f.masterValue;
    return `<tr class="${f.isFormula ? 'dim' : diff ? 'diff' : ''}">
      <td>${check(`fields.${i}.apply`, f.apply, f.isFormula || !diff)}</td>
      <td><b>${esc(f.column)}</b></td><td>${esc(f.masterHeader || f.header)}</td>
      <td>${esc(f.masterValue)}${f.changedSinceRun ? ' <span class="tag warn" title="The value in MASTER differs from the one the prompt saw">changed since run</span>' : ''}</td>
      <td>${f.isFormula ? `<span class="tag">formula – set by ID</span> ${esc(f.proposed)}` : text(`fields.${i}.proposed`, f.proposed)}</td>
      <td>${esc(f.action)}</td><td class="ev">${esc(f.evidence)}</td></tr>`;
  }).join('');
  return `<h3>Letter manifestations, row ${master.letterRow}</h3>
    <p class="muted">Ticked fields are written. Fields marked <i>fill</i> start ticked; <i>review</i> needs your decision.</p>
    <div class="scroll"><table><thead><tr><th>Write</th><th>Col.</th><th>Header</th><th>In MASTER</th><th>Proposed</th><th>Action</th><th>Evidence</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function formsTable(k) {
  const cat = master.catalogs[k.key];
  const rows = review.forms[k.key].map((r, i) => {
    const probs = core.rowProblems(master, k, r);
    const sim = core.similarExisting(master, k, r);
    const notes = [...probs.map(p => `<span class="tag ${p === 'already in master' ? '' : 'err'}">${p}</span>`),
      sim ? `<span class="tag warn">similar to “${esc(sim.form)}” (row ${sim.row})</span>` : ''].join(' ');
    return `<tr class="${probs.length ? 'dim' : r.include ? 'add' : ''}">
      <td>${check(`forms.${k.key}.${i}.include`, r.include && !probs.length, probs.length > 0)}</td>
      <td>${text(`forms.${k.key}.${i}.id`, r.id, 'id')}</td>
      <td>${esc(cat.get(r.id) || r.name)}</td>
      <td>${text(`forms.${k.key}.${i}.form`, r.form, 'form')}</td>
      <td class="ev">${esc(r.evidence)}</td><td>${esc(r.status)}</td><td>${notes}</td></tr>`;
  }).join('');
  const ex = review.existing[k.key].map((e, i) => `<tr class="${e.remove ? 'del' : ''}">
      <td>${check(`existing.${k.key}.${i}.remove`, e.remove)}</td><td>${e.row}</td><td>${esc(e.id)}</td>
      <td>${esc(cat.get(e.id) || '')}</td><td>${esc(e.form)}</td>
      <td>${e.inProposal ? 'yes' : '<span class="tag warn">not in result</span>'}</td></tr>`).join('');
  return `<h3>${esc(k.formsTab)}</h3>
    <p class="muted">Proposed rows. Rows marked <i>ready</i> start ticked; edit an ID or form if needed. Rows without a valid ID cannot be added: create the record in <i>${esc(k.catalogTab)}</i> first, then type its ID here.</p>
    <div class="scroll"><table><thead><tr><th>Add</th><th>ID</th><th>Name (catalogue)</th><th>Form</th><th>Evidence</th><th>Status</th><th>Check</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7" class="muted">none</td></tr>'}</tbody></table></div>
    <button data-add="${k.key}">+ Add row</button>
    <details ${review.existing[k.key].some(e => !e.inProposal) ? 'open' : ''}><summary>Already in MASTER for this letter (${review.existing[k.key].length})</summary>
    <p class="muted">Tick “Clear” to empty a wrong row (the row stays, so other row numbers do not shift).</p>
    <div class="scroll"><table><thead><tr><th>Clear</th><th>Row</th><th>ID</th><th>Name</th><th>Form</th><th>In result</th></tr></thead>
    <tbody>${ex || '<tr><td colspan="6" class="muted">none</td></tr>'}</tbody></table></div></details>`;
}

function render() {
  $('review').innerHTML = fieldsTable() + core.KINDS.map(formsTable).join('') +
    `<label class="opt">${check('updateMentioned', review.updateMentioned)} Also update people/political entities/places_mentioned_IDs (AB, AD, AF) from the Forms rows</label>`;
  renderPlan();
}

function renderPlan() {
  let plan;
  try { plan = core.buildPlan(master, review); } catch (e) { $('plan').innerHTML = `<p class="status err">${esc(e.message)}</p>`; return; }
  $('plan').innerHTML = plan.summary.length
    ? `<ol>${plan.summary.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`
    : '<p class="muted">No changes selected.</p>';
  $('btn-write').disabled = !plan.summary.length || source.kind !== 'google';
  $('btn-write').title = source.kind === 'google' ? '' : 'Test mode: load MASTER from Google to write';
}

$('review').addEventListener('change', e => {
  const path = e.target.dataset.path;
  if (!path) return;
  const parts = path.split('.');
  const obj = parts.slice(0, -1).reduce((o, p) => o[p], review);
  obj[parts.at(-1)] = e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim();
  // an edited row becomes eligible again if it is now valid
  if (e.target.type !== 'checkbox' && parts[0] === 'forms') {
    const k = core.KINDS.find(k => k.key === parts[1]);
    obj.include = !core.rowProblems(master, k, obj).length;
  }
  if (e.target.type !== 'checkbox' && parts[0] === 'fields') obj.apply = obj.proposed !== obj.masterValue;
  render();
});

$('review').addEventListener('click', e => {
  const k = e.target.dataset.add;
  if (!k) return;
  review.forms[k].push({ letter: review.letterId, id: '', name: '', form: '', evidence: '', status: 'added by reviewer', include: false });
  render();
});

/* ---------- writing ---------- */
// The plan was built on the MASTER loaded earlier; refuse if MASTER moved underneath it.
const base = m => JSON.stringify([m.letterRow, m.lastRow, core.KINDS.map(k => m.forms[k.key]), m.letterValues]);

$('btn-write').onclick = async () => {
  const btn = $('btn-write');
  btn.disabled = true;
  status('write-status', 'Checking MASTER has not changed…');
  try {
    const fresh = await loadMasterFor(review.letterId);
    if (base(fresh) !== base(master)) {
      throw new Error('MASTER changed since you loaded it (someone else may be editing). Load the result file again and re-check.');
    }
    const plan = core.buildPlan(master, review);
    status('write-status', 'Writing…');
    if (plan.raw.length) await api('/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: plan.raw }) });
    if (plan.formulas.length) await api('/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: plan.formulas }) });
    status('write-status', `Done: ${plan.summary.length} changes written. <a href="${esc(source.url)}" target="_blank" rel="noopener">Open MASTER</a>`, 'ok');
    await startReview(); // show the new state of MASTER
  } catch (e) {
    status('write-status', esc(e.message), 'err');
    btn.disabled = false;
  }
};

$('btn-export').onclick = () => {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(core.reviewToSheets(review))) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  XLSX.writeFile(wb, `${review.letterId}_result_reviewed.xlsx`);
};
