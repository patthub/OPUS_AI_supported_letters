# How to use the OPUS prompt (v3)

The prompt is in OPUS_prompt_v3.md. That plain-text file is the master copy: it can be pasted into any chat model or system. OPUS_prompt_v3.docx contains the same text for reading and commenting. All the files are at https://github.com/patthub/OPUS_AI_supported_letters, in the prompt folder.

## Running the prompt

1. Process one letter per run.
2. Copy the whole prompt and replace the three placeholders in braces under "Input for this run": the database, the letter_manifestation_ID and the transcription. If a placeholder remains, the model stops and asks for the missing input.
3. Attach the current, complete OPUS workbook as an Excel file (.xlsx), or give a link the model can open. The model finds the rows itself; you do not need to select them.
4. Attach the transcription (for example, a Google Doc downloaded as .docx), paste it into the message, or give a link the model can open. Include Smith's footnotes if you have them: the model uses them to identify people and places.
5. Before running, check that the model can open every link. If it cannot, attach the file instead. The transcription link stored in the database is in column AO (transcription).

## Choosing a model or system

Use a model that can read an attached Excel workbook in full, ideally one that can run code on files. If it cannot read a catalogue tab completely, it marks the affected identities not_checked. Treat such a result as incomplete and rerun the letter in a stronger setup.

## The result

The model returns two files:

- an English Word document for review. Where the model cannot create files, it returns the same sections as Markdown tables, which can be pasted into Word;
- <letter ID>_result.xlsx, the upload file for the OPUS upload tool. Where the model cannot create files, it returns CSV blocks; paste each into the matching sheet of result_template.xlsx.

The result is a draft for review, not a database update.

Reviewers should check:

- the boundary between the letter and Smith's editorial note;
- entity identifications, especially rows with the status review;
- forms as written, and proposed corrections to existing Forms rows;
- internal and Wikidata IDs;
- dates whose calendar style the letter does not state.

A human must create new records and assign their IDs before the rows marked "awaiting assigned ID" are entered. Columns H, L, P and T, and the name columns of the Forms tabs, fill themselves by formula once the IDs are entered.

## Adding the result to MASTER

Open the OPUS upload tool at https://patthub.github.io/OPUS_AI_supported_letters/, sign in with Google, and load the result file. The tool compares the result with MASTER and shows what is already there, what is new, and what needs a decision. Tick what should go in, correct IDs or forms where needed, and check the list of changes before writing. Nothing is written to MASTER until you press the write button.
