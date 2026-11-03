// Pure logic: no DOM, no network. Sheets are arrays of rows (row 0 = headers).
// Tested by test/core.test.mjs.

export const LETTERS = 'Letter manifestations';

export const KINDS = [
  { key: 'people', formsTab: 'People Forms', catalogTab: 'People', mentioned: 'AB',
    headers: ['letter_manifestation_ID', 'person_ID', 'person_name', 'person_name_form'] },
  { key: 'places', formsTab: 'Places Forms', catalogTab: 'Places', mentioned: 'AF',
    headers: ['letter_manifestation_ID', 'place_ID', 'place_name', 'place_name_form'] },
  { key: 'entities', formsTab: 'Political entities Forms', catalogTab: 'Political entities', mentioned: 'AD',
    headers: ['letter_manifestation_ID', 'political_entity_ID', 'political_entity_name', 'political_entity_name_form'] },
];

export const RESULT_FIELD_HEADERS = ['column', 'header', 'current_value', 'proposed_value', 'action', 'certainty', 'evidence'];
export const RESULT_FORM_EXTRA = ['evidence_paragraph', 'status'];

const EMPTY = new Set(['', '—', '–', '-', '(empty)', 'empty', 'n/a', 'none']);
export const clean = v => {
  const s = String(v ?? '').trim();
  return EMPTY.has(s.toLowerCase()) ? '' : s;
};
const norm = h => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const colIndex = letter => [...letter.toUpperCase()].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
export const colLetter = i => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };

// The Forms tabs have a VLOOKUP pre-filled in column C; new rows get the same formula.
export function nameFormula(kind, row) {
  const tab = /\s/.test(kind.catalogTab) ? `'${kind.catalogTab}'` : kind.catalogTab;
  return `=IF(B${row}="","",IFERROR(VLOOKUP(TRIM(B${row}),${tab}!$A:$B,2,FALSE),""))`;
}

// Map rows to objects by header, tolerant of case, spaces and dashes ("Evidence – paragraph").
function readTable(rows, wanted) {
  if (!rows?.length) return { items: [], missing: wanted };
  const pos = rows[0].map(norm);
  const at = Object.fromEntries(wanted.map(w => [w, pos.indexOf(norm(w))]));
  const missing = wanted.filter(w => at[w] < 0);
  const items = rows.slice(1)
    .map(r => Object.fromEntries(wanted.map(w => [w, at[w] < 0 ? '' : clean(r[at[w]])])))
    .filter(o => Object.values(o).some(Boolean));
  return { items, missing };
}

/** Result workbook produced by the prompt → structured proposal. */
export function parseResult(sheets) {
  const errors = [];
  const find = name => Object.keys(sheets).find(n => norm(n) === norm(name));

  const fieldsName = find(LETTERS);
  if (!fieldsName) errors.push(`Missing sheet "${LETTERS}".`);
  const f = readTable(sheets[fieldsName], RESULT_FIELD_HEADERS);
  if (fieldsName && f.missing.length) errors.push(`"${LETTERS}" lacks columns: ${f.missing.join(', ')}.`);
  const fields = f.items.filter(x => /^[A-Z]{1,2}$/i.test(x.column)).map(x => ({ ...x, column: x.column.toUpperCase() }));

  const forms = {};
  for (const k of KINDS) {
    const name = find(k.formsTab);
    if (!name) { errors.push(`Missing sheet "${k.formsTab}".`); forms[k.key] = []; continue; }
    const t = readTable(sheets[name], [...k.headers, ...RESULT_FORM_EXTRA]);
    const req = t.missing.filter(m => k.headers.includes(m) && m !== k.headers[2]);
    if (req.length) errors.push(`"${k.formsTab}" lacks columns: ${req.join(', ')}.`);
    forms[k.key] = t.items.map(x => ({
      letter: x[k.headers[0]], id: x[k.headers[1]], name: x[k.headers[2]], form: x[k.headers[3]],
      evidence: x.evidence_paragraph, status: x.status,
    }));
  }

  const ids = new Set([
    ...Object.values(forms).flat().map(r => r.letter),
    fields.find(x => x.column === 'A')?.proposed_value || fields.find(x => x.column === 'A')?.current_value,
  ].filter(Boolean));
  if (ids.size !== 1) errors.push(ids.size ? `More than one letter ID in the file: ${[...ids].join(', ')}.` : 'No letter ID found.');
  return { letterId: [...ids][0] || '', fields, forms, errors };
}

/** Master workbook → what the review needs for one letter.
 *  letterFormulaCols: Set of column letters whose cell in the letter's row holds a formula. */
export function indexMaster(sheets, letterId, letterFormulaCols = new Set()) {
  const letters = sheets[LETTERS] || [];
  const headers = letters[0] || [];
  const rowIdx = letters.findIndex((r, i) => i > 0 && clean(r[0]) === letterId);
  const catalogs = {}, forms = {}, lastRow = {};
  for (const k of KINDS) {
    catalogs[k.key] = new Map((sheets[k.catalogTab] || []).slice(1)
      .filter(r => clean(r[0])).map(r => [clean(r[0]), clean(r[1])]));
    const rows = sheets[k.formsTab] || [];
    let last = 1;
    rows.forEach((r, i) => { if (clean(r[0])) last = i + 1; });
    lastRow[k.key] = last;
    forms[k.key] = rows.map((r, i) => ({ row: i + 1, letter: clean(r[0]), id: clean(r[1]), form: clean(r[3]) }))
      .filter(r => r.row > 1 && r.letter === letterId);
  }
  return {
    letterId, headers,
    letterRow: rowIdx > 0 ? rowIdx + 1 : null,
    letterValues: rowIdx > 0 ? letters[rowIdx] : [],
    letterFormulaCols, catalogs, forms, lastRow,
  };
}

const key = (id, form) => `${id}\u0000${form}`;

// "The Cardinal Alen's" ~ "Cardinal Alen": same apart from case, a leading article or a possessive ending.
const loose = f => f.toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/(['’]s|['’])$/, '').trim();

/** Existing master row for the same ID whose form differs only loosely (not exactly). */
export function similarExisting(master, kind, r) {
  return master.forms[kind.key].find(e => e.id === r.id && e.form !== r.form && loose(e.form) === loose(r.form));
}

/** Merge proposal with master into an editable review state. */
export function buildReview(master, result) {
  const fields = result.fields.map(f => {
    const i = colIndex(f.column);
    const masterValue = clean(master.letterValues[i]);
    const isFormula = master.letterFormulaCols.has(f.column);
    const proposed = f.proposed_value === 'No change' ? masterValue : f.proposed_value;
    return {
      ...f, proposed, masterValue, isFormula,
      masterHeader: master.headers[i] ?? '',
      changedSinceRun: f.current_value !== masterValue,
      apply: !isFormula && f.action.toLowerCase() === 'fill' && proposed !== masterValue,
    };
  });
  const forms = {}, existing = {};
  for (const k of KINDS) {
    const have = new Set(master.forms[k.key].map(r => key(r.id, r.form)));
    forms[k.key] = result.forms[k.key].map(r => ({
      ...r,
      include: Boolean(r.id) && master.catalogs[k.key].has(r.id) && !have.has(key(r.id, r.form))
        && !similarExisting(master, k, r) && r.status.toLowerCase().startsWith('ready'),
    }));
    const proposed = new Set(result.forms[k.key].map(r => key(r.id, r.form)));
    existing[k.key] = master.forms[k.key].map(r => ({ ...r, inProposal: proposed.has(key(r.id, r.form)), remove: false }));
  }
  return { letterId: master.letterId, fields, forms, existing, updateMentioned: true };
}

/** Problems of one proposed form row given the current master; empty array = can be written. */
export function rowProblems(master, kind, r) {
  const p = [];
  if (!r.id) p.push('no ID');
  else if (!master.catalogs[kind.key].has(r.id)) p.push('ID not in catalogue');
  if (!r.form) p.push('empty form');
  if (master.forms[kind.key].some(e => e.id === r.id && e.form === r.form)) p.push('already in master');
  return p;
}

export function mentionedIds(master, review, kind) {
  const keep = review.existing[kind.key].filter(e => !e.remove).map(e => e.id);
  const add = review.forms[kind.key].filter(r => r.include && !rowProblems(master, kind, r).length).map(r => r.id);
  return [...new Set([...keep, ...add].filter(Boolean))];
}

/** Concrete cell writes. raw = literal values; formulas = USER_ENTERED. */
export function buildPlan(master, review) {
  if (!master.letterRow) throw new Error(`Letter ${review.letterId} not found in master.`);
  const raw = [], formulas = [], summary = [];
  const L = master.letterRow;

  for (const f of review.fields) {
    if (!f.apply || f.isFormula || f.proposed === f.masterValue) continue;
    raw.push({ range: `'${LETTERS}'!${f.column}${L}`, values: [[f.proposed]] });
    summary.push(`${LETTERS} ${f.column}${L} (${f.header}): "${f.masterValue}" → "${f.proposed}"`);
  }

  for (const k of KINDS) {
    const tab = `'${k.formsTab}'`;
    for (const e of review.existing[k.key].filter(e => e.remove)) {
      raw.push({ range: `${tab}!A${e.row}:B${e.row}`, values: [['', '']] });
      raw.push({ range: `${tab}!D${e.row}`, values: [['']] });
      summary.push(`${k.formsTab} row ${e.row}: clear ${e.id} "${e.form}"`);
    }
    const rows = review.forms[k.key].filter(r => r.include && !rowProblems(master, k, r).length);
    rows.forEach((r, i) => {
      const n = master.lastRow[k.key] + 1 + i;
      raw.push({ range: `${tab}!A${n}:B${n}`, values: [[review.letterId, r.id]] });
      raw.push({ range: `${tab}!D${n}`, values: [[r.form]] });
      formulas.push({ range: `${tab}!C${n}`, values: [[nameFormula(k, n)]] });
      summary.push(`${k.formsTab} row ${n}: add ${r.id} "${r.form}"`);
    });

    const touched = rows.length || review.existing[k.key].some(e => e.remove);
    if (touched && review.updateMentioned && !master.letterFormulaCols.has(k.mentioned)) {
      const next = mentionedIds(master, review, k).join(' | ');
      const now = clean(master.letterValues[colIndex(k.mentioned)]);
      const same = now.split('|').map(s => s.trim()).filter(Boolean).join(' | ') === next;
      if (!same) {
        raw.push({ range: `'${LETTERS}'!${k.mentioned}${L}`, values: [[next]] });
        summary.push(`${LETTERS} ${k.mentioned}${L}: "${now}" → "${next}"`);
      }
    }
  }
  return { raw, formulas, summary };
}

/** Review state → workbook in the result format (to save a review in progress). */
export function reviewToSheets(review) {
  const sheets = {
    [LETTERS]: [RESULT_FIELD_HEADERS, ...review.fields.map(f =>
      [f.column, f.header, f.masterValue, f.proposed, f.action, f.certainty, f.evidence])],
  };
  for (const k of KINDS) {
    sheets[k.formsTab] = [[...k.headers, ...RESULT_FORM_EXTRA],
      ...review.forms[k.key].map(r => [review.letterId, r.id, r.name, r.form, r.evidence, r.status])];
  }
  return sheets;
}
