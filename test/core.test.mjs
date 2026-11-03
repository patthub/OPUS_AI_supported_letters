// node test/core.test.mjs — synthetic data only (the real master must not be committed).
import assert from 'node:assert/strict';
import * as core from '../core.js';

const H = Array.from({ length: 33 }, (_, i) => core.colLetter(i)); // headers irrelevant except position
H[0] = 'letter_manifestation_ID'; H[4] = 'date_of_letter'; H[7] = 'author_name'; H[31] = 'places_mentioned_IDs';
const letterRow = Array(33).fill(''); letterRow[0] = 'L_1'; letterRow[4] = '1605-00-00'; letterRow[7] = 'Henry Wotton';
letterRow[31] = 'place_1 | place_2 |';

const master = core.indexMaster({
  'Letter manifestations': [H, ['L_0'], letterRow],
  People: [['person_ID', 'person_name'], ['person_1', 'A'], ['person_2', 'B']],
  Places: [['place_ID', 'place_name'], ['place_1', 'Venice'], ['place_2', 'Geneva'], ['place_3', 'Genoa']],
  'Political entities': [['political_entity_ID', 'entity_name']],
  'People Forms': [core.KINDS[0].headers, ['L_1', 'person_1', '=x', 'Cardinal Alen'], ['', '', '=x', ''], ['L_0', 'person_2', '=x', 'B'], ['', '', '=x', '']],
  'Places Forms': [core.KINDS[1].headers, ['L_1', 'place_1 ', '=x', 'Venice'], ['L_1', 'place_2', '=x', 'Genua']],
  'Political entities Forms': [core.KINDS[2].headers],
}, 'L_1', new Set(['H']));

assert.equal(master.letterRow, 3);
assert.equal(master.lastRow.people, 4, 'last filled row ignores formula-only rows');
assert.equal(master.forms.places[0].id, 'place_1', 'IDs are trimmed');

const result = core.parseResult({
  'Letter manifestations': [core.RESULT_FIELD_HEADERS,
    ['A', 'letter_manifestation_ID', 'L_1', 'L_1', 'retain', '', ''],
    ['E', 'date_of_letter', '1605-00-00', '1605-08-18', 'fill', 'certain', 'P3'],
    ['H', 'author_name', 'Henry Wotton', 'Henry Wotton', 'retain', '', '']],
  'People Forms': [[...core.KINDS[0].headers.slice(0, 2), 'Person name', 'person_name_form', 'Evidence – paragraph', 'Status'],
    ['L_1', 'person_1', 'A', 'Cardinal Alen', 'P1', 'ready'],          // already in master
    ['L_1', 'person_1', 'A', 'the Cardinal Alen', 'P2', 'ready'],      // near-duplicate
    ['L_1', 'person_2', 'B', 'Mr B', 'P3', 'ready'],                   // new
    ['L_1', '', 'New', 'the Primate', 'P4', 'awaiting assigned ID'],   // no ID
    ['L_1', 'person_9', 'X', 'X', 'P5', 'ready']],                     // unknown ID
  'Places Forms': [[...core.KINDS[1].headers, 'evidence_paragraph', 'status'],
    ['L_1', 'place_1', 'Venice', 'Venice', 'P1', 'ready'],
    ['L_1', 'place_3', 'Genoa', 'Genua', 'P7', 'review – replaces place_2']],
  'Political entities Forms': [[...core.KINDS[2].headers, 'evidence_paragraph', 'status']],
});
assert.deepEqual(result.errors, []);
assert.equal(result.letterId, 'L_1');

const review = core.buildReview(master, result);
assert.deepEqual(review.forms.people.map(r => r.include), [false, false, true, false, false]);
assert.ok(core.similarExisting(master, core.KINDS[0], review.forms.people[1]));
assert.deepEqual(core.rowProblems(master, core.KINDS[0], review.forms.people[3]), ['no ID']);
assert.deepEqual(core.rowProblems(master, core.KINDS[0], review.forms.people[4]), ['ID not in catalogue']);
assert.equal(review.forms.places[1].include, false, 'review rows start unticked');
assert.deepEqual(review.fields.map(f => f.apply), [false, true, false]);

// reviewer accepts Genoa, removes the Geneva row, and tries to force a formula column
review.forms.places[1].include = true;
review.existing.places.find(e => e.id === 'place_2').remove = true;
review.fields[2].apply = true; review.fields[2].proposed = 'X';
const plan = core.buildPlan(master, review);
const ranges = plan.raw.map(o => o.range);

assert.ok(ranges.includes("'Letter manifestations'!E3"));
assert.ok(!ranges.some(r => r.endsWith('!H3')), 'formula column never written');
assert.ok(ranges.includes("'People Forms'!A5:B5"), 'new row goes after last filled row');
assert.equal(plan.formulas.find(o => o.range === "'People Forms'!C5").values[0][0],
  '=IF(B5="","",IFERROR(VLOOKUP(TRIM(B5),People!$A:$B,2,FALSE),""))');
assert.ok(ranges.includes("'Places Forms'!A3:B3"), 'removed row is cleared, not deleted');
assert.ok(ranges.includes("'Places Forms'!A4:B4"));
assert.deepEqual(plan.raw.find(o => o.range === "'Letter manifestations'!AF3").values, [['place_1 | place_3']]);
assert.equal(plan.formulas.find(o => o.range === "'Political entities Forms'!C2"), undefined);

// nothing to do → empty plan (mentioned IDs equal up to separators)
const idle = core.buildReview(master, { ...result, fields: [], forms: { people: [], places: [], entities: [] } });
assert.deepEqual(core.buildPlan(master, idle).raw, []);

assert.equal(core.colIndex('AG'), 32); assert.equal(core.colLetter(32), 'AG');
console.log('core: all checks passed');
