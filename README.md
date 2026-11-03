# OPUS — AI-supported letter annotation

Two parts:

- **`prompt/`**: the annotation prompt (`OPUS_prompt_v3.md`, usable with any LLM), how to use it, and `result_template.xlsx`, the format of the upload file the prompt produces.
- **The upload tool** (https://patthub.github.io/OPUS_AI_supported_letters/): a static page that loads a prompt result, compares it with the MASTER Google Sheet, lets a reviewer correct it, and writes the accepted rows to MASTER.

No server of our own. The page reaches MASTER in one of two ways: through a small Apps Script attached to MASTER (option A), or through the Google Sheets API with each person's own Google sign-in (option B).

## What the tool writes, and what it never touches

- New rows in *People Forms*, *Places Forms* and *Political entities Forms*, after the last filled row (the formula rows pre-filled further down are reused, not skipped). Column C gets the same name-lookup formula as the existing rows.
- Ticked fields of the letter's row in *Letter manifestations*. Cells holding a formula (H, L, P, T, AA, AC, AE…) are never written; set their ID column instead.
- `people_mentioned_IDs`, `political_entities_mentioned_IDs`, `places_mentioned_IDs` (AB, AD, AF), recalculated from the letter's Forms rows. This happens only when that kind of Forms row changes, and only if the cell has no formula.
- Existing Forms rows that the reviewer marks as wrong are **cleared, not deleted**, so no other row moves.

Before writing, the tool reads MASTER again and stops if anything it relied on has changed since loading (for example, someone else added rows). The whole plan is shown before anything is written. Every write is recorded in the Google Sheet's version history (File → Version history). With option A, it is also listed in the *Upload log* tab.

## One-time setup

### 1. MASTER must be a Google Sheet

The Sheets API cannot write to an Excel file stored in Drive. A link containing `rtpof=true` points to such a file. Open it and choose **File → Save as Google Sheets**, then use the new link. Paste that link into the page; the browser remembers it. You can also put it in `config.js` (`masterUrl`), but this repository is public, so do this only if the link itself may be public.

### 2. Connect the page to MASTER: choose A or B

**Option A — Apps Script (no Google Cloud setup, about 3 minutes).** A small script inside MASTER reads and writes for the page.

1. Open MASTER → **Extensions → Apps Script**. Replace the editor's contents with [`tools/apps_script.gs`](tools/apps_script.gs) and save.
2. **Project Settings (gear) → Script properties → Add**: property `KEY`, value: a long random password. This is the team's access key.
3. **Deploy → New deployment → Web app**. Set *Execute as*: **Me**, and *Who has access*: **Anyone**. Click Deploy, authorise when Google asks, and copy the web-app URL (`https://script.google.com/macros/s/…/exec`).
4. In the page, paste the web-app URL instead of the sheet link. Enter the key and your name, then click **Load**.

Trade-off: the script writes as the person who deployed it, so the sheet's version history shows that person as the author of every write. The tool records who uploaded what in an **Upload log** tab instead, using the name typed in the page. Anyone holding both the URL and the key can write, so share them only within the team, never in this public repository. To revoke access, change `KEY` or archive the deployment.

After changing the script, use **Deploy → Manage deployments → Edit → New version**. Otherwise the URL keeps running the old code.

**Option B — Google sign-in (per-person accounts, needs a Google Cloud OAuth client).** Each person signs in with their own Google account, and the sheet's version history shows who changed what. In [Google Cloud Console](https://console.cloud.google.com/):

1. Create a project (for example *OPUS upload*).
2. **APIs & Services → Library**: enable **Google Sheets API**.
3. **Google Auth Platform → Branding / Audience**: set the app name and support email.
   - If everyone uses accounts in one Google Workspace organisation, choose **Internal**.
   - Otherwise choose **External**, leave it in **Testing**, and add every team member's Google account as a **test user** (up to 100).
4. **Data access**: add the scope `https://www.googleapis.com/auth/spreadsheets`.
5. **Clients → Create client → Web application**. Under **Authorised JavaScript origins** add `https://patthub.github.io` and `http://localhost:8765`.
6. Copy the **Client ID** into `config.js` (`clientId`). The Client ID is public by design; no secret is used.

Each team member needs edit access to MASTER. While the app is in Testing mode, Google shows an "unverified app" screen at sign-in. Choose *Continue*.

## Using it

1. Run the prompt for one letter; keep the Word review and `<letter ID>_result.xlsx`.
2. Open the tool, paste the Apps Script URL (with the key) or the MASTER link, and click **Load**.
3. Load the result file. The review shows:
   - letter fields with the MASTER value next to the proposed one. Fields marked *fill* start ticked; fields marked *review* need your decision;
   - proposed Forms rows. Rows that are *ready*, valid and new start ticked. Rows already in MASTER are greyed out. A row that differs from an existing one only by an article or `'s` is flagged *similar*. A row without a valid ID cannot be added: create the record in the catalogue tab first, then type its ID into the row;
   - Forms rows already in MASTER for this letter. Rows missing from the result are flagged, so you can decide whether to clear them.
4. Read the list under **Changes to MASTER**, then press **Write**. **Download reviewed result** saves your choices as an .xlsx file, so you can stop and continue later.

**Test without Google:** load a local .xlsx export of MASTER instead of signing in. Everything works except writing.

## Development

```
python3 -m http.server 8765      # then open http://localhost:8765
node test/core.test.mjs          # logic tests (synthetic data)
```

`core.js` holds all logic (pure functions, tested). `app.js` holds the page and the Google calls. `config.js` holds the two settings. `tools/md2docx.py` makes the Word versions of the prompt files (`pip install python-docx`).

Do not commit MASTER, transcriptions or results: `.gitignore` excludes `.xlsx` and `.docx` files apart from the template.
