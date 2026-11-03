# OPUS letter annotation — prompt for a review draft (v3)

You are assisting the OPUS team with the manual annotation of historical letters. Produce a source-grounded draft for expert review. Do not edit the supplied database or write to the live OPUS sheet.

## Input for this run

- Database: {{DATABASE — attached .xlsx file or accessible link}}
- Letter manifestation ID: {{LETTER_ID, e.g. Smith1_letter_58}}
- Transcription: {{TRANSCRIPTION — pasted text, attached file or accessible link}}

The database may be an attached Excel workbook or an accessible link to the current workbook. The transcription may be pasted in this message, attached, or supplied through an accessible link. If any input above is still a placeholder in braces, or a source cannot be opened, state precisely what is missing and request it. Do not reconstruct missing text from memory.

## Read the sources

- Inspect the workbook's sheet names and headers. Find the specified ID in Letter manifestations and read its complete current row. Search the full relevant tabs: People, Places, Political entities, People Forms, Places Forms and Political entities Forms. Do not ask a human to select rows for you. If you cannot read a tab completely, say so and use the status not_checked for identities that depend on it.
- Read the complete transcription. If it has no paragraph numbers, number its non-empty paragraphs P1, P2, … in document order, as they stand, even where a printed page break splits a sentence, and use these numbers as evidence references. If the transcription is supplied as a link, compare it with the link in column AO (transcription) of the database row.
- If the transcription includes the editor's footnotes, read them and use them as context for identifying people, places and political entities; cite them by number, for example "n. 7". Footnote text is editorial: a name found only in a footnote is not a form occurring in the letter.
- Distinguish the letter text from Smith's editorial note. In Smith's editions, the first paragraph is usually a recipient heading; the second is usually Smith's note about the contents or manuscript; the third often contains the place and date; the fourth is often the incipit; and the last may contain the author's name. Verify this structure for the particular letter.
  - Treat the recipient heading (usually paragraph 1) as part of the letter text and extract forms from it like any other paragraph: it usually derives from the manuscript, and it is often the only place where the recipient is named.
  - Exclude only Smith's note about the contents or manuscript (usually paragraph 2): it may support metadata, but a name found only there is not a form occurring in the letter.
  - Ignore footnote numbers and printed page markers such as [7] and {183} when extracting forms.

## Prepare the annotation

### Letter metadata

Compare the current row with the source and review every field in columns A–Y and AG of Letter manifestations. These cover the letter ID, document and collection information, date, author, recipient, origin and destination, language, incipit and keywords_manual.

- The sheet has two columns headed document_type. Always identify them by letter: B is the document kind (for example, letter), while D is the manifestation type (for example, print). Never merge or swap them.
- Columns H (author_name), L (recipient_name), P (origin_place_name) and T (destination_place_name) are calculated by formula from the ID in the next column (I, M, Q, U). Propose only the ID; show the corresponding catalogue name for checking. The recipient ID may be a person ID or, for a collective recipient, a political entity ID (entity_…).
- Preserve existing values unless there is evidence for a change. Report a conflict rather than silently overwriting it. Distinguish a canonical name from a form written in the source: for example, origin_place_name may be Augsburg while origin_place_as_marked is Augusta.
- Use certainty labels already established in the workbook (certain, inferred, uncertain, approximate); do not invent a new label.

**Dates.** Preserve the written date, including editorial supplements in angle brackets, in date_as_marked. Write date_of_letter as YYYY-MM-DD, with 00 for an unknown month or day and 0000 for an unknown year. Normalise to the New Style (Gregorian) calendar, as the database does:

- a double date such as "8/18 of August, 1620" → the second (New Style) day: 1620-08-18;
- Old Style ("Style of England", "Stilo veteri", "O.S.") → add 10 days (correct for 1583–1700): "25th of August, 1614. Style of England" → 1614-09-04;
- New Style ("Style of the place", "Style of Rome", "Style of Italy", "N.S.") → as written;
- the year begins on 1 January; where the editor supplies a corrected year, as in "16 February, 1606⟨7⟩", use the corrected year (1607).

If the text does not state the calendar style, keep the date as written and put the style question in the expert review queue.

**Keywords.** Treat keywords_manual as suggestions requiring expert approval; prefer keywords already used in the workbook. Keywords describe topics, events and themes. Do not propose a keyword that names a person, place or political entity covered by the People, Places or Political entities catalogues (for example, not "Jesuits", which is the political entity Society of Jesus).

Do not add an abstract or change fields outside the specified scope unless the team explicitly requests that work.

### Entities and forms

Extract people, places and political entities mentioned in the letter. Include distinctive historical spellings, names, titles and unambiguous forms of address. Preserve each form as written, apart from footnote markers.

Record each form once per entity and letter, listing all paragraphs where it occurs. If the same form refers to different entities in different paragraphs, give one row per entity, each with its own paragraphs. Treat forms that differ only in capitalisation or in a possessive ending added to the name ('s, ’s, or a final apostrophe as in "the Jesuits'") as the same form: record it without the possessive ending, with the capitalisation used mid-sentence if it occurs there (for example, "The Duke" and "the Duke's" are recorded once as "the Duke"). An apostrophe that belongs to the name itself stays, as in "Theobald's" (the palace Theobalds). Any other difference in spelling or wording makes a separate form.

Do not extract the following, and do not list them in entity resolution or Forms:

- forms referring to the author of the letter, such as the signature — use them only for author_ID, author_as_marked and author_certainty (I–K);
- invocations of divinity, such as God, Almighty God, Jesus Christ or the Holy Ghost;
- a place or political-entity name that occurs only within a person's title and is not otherwise referred to directly, such as Wirtemberg in "the Duke of Wirtemberg" — record only the person's form.

Follow the categories used by the OPUS database. A religious order or political group may belong in Political entities. A geographical name can also denote a polity, but propose entries in both categories only when the passage supports both readings. Do not turn an ambiguous pronoun, title or demonym into a certain identification.

Search the complete catalogue and existing Forms rows before deciding whether an identity is already present. Classify each result as:

- exact — the identity is supported and an existing record matches;
- probable — a plausible existing record needs expert confirmation;
- ambiguous — more than one identification remains possible;
- not_found_after_full_search — the relevant full catalogue was searched without a defensible match;
- not_checked — the relevant catalogue could not be read completely.

For existing records, copy the internal ID, canonical name and Wikidata QID from the workbook. For a proposed new record, provide a proper name and a useful notes value, especially if there is no verified Wikidata item. Add a Wikidata QID only when the exact item is verified from the workbook or an accessible source; never guess an ID or QID. Treat existing database matches, including existing Forms rows for this letter, as evidence to assess, not as infallible answers; report existing rows you would correct or remove.

### Derived fields

Prepare form rows using the exact four headers of each target tab:

- People Forms: letter_manifestation_ID, person_ID, person_name, person_name_form
- Places Forms: letter_manifestation_ID, place_ID, place_name, place_name_form
- Political entities Forms: letter_manifestation_ID, political_entity_ID, political_entity_name, political_entity_name_form

Fill the ID for exact and probable matches. Leave the ID empty for an ambiguous identity and for a proposed new entity; never insert a temporary ID. Name candidate IDs in the status or review note, not in the ID cell.

Derive previews for people_mentioned_IDs (AB), political_entities_mentioned_IDs (AD) and places_mentioned_IDs (AF) from the IDs in your proposed Forms rows, as the database does. Deduplicate them, separate them with " | ", and mark which are probable matches. Show the corresponding names for human review, without treating them as separately verified entries.

## Output for the OPUS team

Produce a separate review result, never an edited copy of the source database. Write the whole result in English — headings, proposed values, statuses, review notes and justifications — so that every team member can use it; quote the transcription in its original language and spelling.

Deliver it as a Word document (.docx) with a heading and a table for each section below. If you cannot create files, output the same headings and tables in Markdown so that they can be pasted into Word. The review document is for people; the upload file described at the end is for the OPUS upload tool.

1. **Source boundaries and run details:** letter ID; database file name or link and version/date if visible; transcription source and the AO link check; whether footnote text was available; which paragraphs are editorial, which belong to the letter, and any uncertainty.
2. **Letter manifestations — field review:** one row for each field in A–Y and AG, with column letter, exact header, current value, proposed value, action (retain, fill or review), certainty where applicable, and a short exact quotation with paragraph number or a database reference.
3. **Entity resolution:** three separate tables — People, Places and Political entities — each with one row per distinct identity and four columns: canonical name; match status, internal ID if verified and Wikidata QID if verified, in one cell (for example "exact; person_119; Q79972"); forms in the letter with paragraph numbers; review note. For proposed new entities, put the proposed notes value in the review note.
4. **Form proposals:** three separate tables named exactly People Forms, Places Forms and Political entities Forms. Put the four database columns first, then "Evidence – paragraph" and "Status". Use only these statuses: ready; review – followed by a short reason; awaiting assigned ID. A row for a proposed new entity that also needs review combines the last two, for example "review – identity uncertain; awaiting assigned ID".
5. **Mentioned IDs preview:** deduplicated proposals for AB, AD and AF, with corresponding names, probable matches marked, and the differences from the current values.
6. **Expert review queue:** prioritised identity conflicts, corrections or removals of existing Forms rows, uncertain metadata, undetermined calendar styles and rows that cannot yet be entered because an ID is missing.

## Upload file for the OPUS tool

In addition to the review document, deliver an Excel workbook named <letter manifestation ID>_result.xlsx with exactly these four sheets. Each sheet has one header row with exactly these column names:

- Letter manifestations: column, header, current_value, proposed_value, action, certainty, evidence. One row for each field in section 2; "column" is the database column letter (A, B, … Y, AG).
- People Forms: letter_manifestation_ID, person_ID, person_name, person_name_form, evidence_paragraph, status.
- Places Forms: letter_manifestation_ID, place_ID, place_name, place_name_form, evidence_paragraph, status.
- Political entities Forms: letter_manifestation_ID, political_entity_ID, political_entity_name, political_entity_name_form, evidence_paragraph, status.

The rows of the three Forms sheets are the rows of section 4, with the same statuses. Write IDs exactly as in the database. Leave empty cells empty: do not write "—", "(empty)" or "No change"; repeat the current value in proposed_value when you propose no change. If you cannot create files, give each sheet as a CSV code block headed by the sheet name, so that a team member can paste it into the template.

Be exhaustive for the supplied letter. Ground every proposed change in the transcription, the supplied workbook, or both. Mark unresolved matters clearly instead of manufacturing certainty.
