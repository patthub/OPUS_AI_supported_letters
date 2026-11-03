# OPUS — AI-supported letter annotation

Two parts:

- **`prompt/`**: the annotation prompt (`OPUS_prompt_v3.md`, usable with any LLM), how to use it, and `result_template.xlsx`, the format of the upload file the prompt produces.
- **The upload tool** (https://patthub.github.io/OPUS_AI_supported_letters/): a static page that loads a prompt result, compares it with the MASTER Google Sheet, lets a reviewer correct it, and writes the accepted rows to MASTER.

No server. The page talks to the Google Sheets API from the browser, signed in as the person using it, so it can do only what that person can already do in MASTER.

## What the tool writes, and what it never touches

- New rows in *People Forms*, *Places Forms* and *Political entities Forms*, after the last filled row (the formula rows pre-filled further down are reused, not skipped). Column C gets the same name-lookup formula as the existing rows.
- Ticked fields of the letter's row in *Letter manifestations*. Cells holding a formula (H, L, P, T, AA, AC, AE…) are never written; set their ID column instead.
- `people_mentioned_IDs`, `political_entities_mentioned_IDs`, `places_mentioned_IDs` (AB, AD, AF), recalculated from the letter's Forms rows. This happens only when that kind of Forms row changes, and only if the cell has no formula.
- Existing Forms rows that the reviewer marks as wrong are **cleared, not deleted**, so no other row moves.

Before writing, the tool reads MASTER again and stops if anything it relied on has changed since loading (for example, someone else added rows). The whole plan is shown before anything is written. Every write is recorded in the Google Sheet's version history (File → Version history), which serves as the audit trail.

## One-time setup

### 1. MASTER must be a Google Sheet

The Sheets API cannot write to an Excel file stored in Drive. A link containing `rtpof=true` points to such a file. Open it and choose **File → Save as Google Sheets**, then use the new link. Paste that link into the page; the browser remembers it. You can also put it in `config.js` (`masterUrl`), but this repository is public, so do this only if the link itself may be public.

### 2. Google sign-in (OAuth client)

In [Google Cloud Console](https://console.cloud.google.com/), with the account that will own the setup:

1. Create a project (for example *OPUS upload*).
2. **APIs & Services → Library**: enable **Google Sheets API**.
3. **Google Auth Platform → Branding / Audience**: set the app name and support email.
   - If everyone uses accounts in one Google Workspace organisation, choose **Internal**.
   - Otherwise choose **External**, leave it in **Testing**, and add every team member's Google account as a **test user** (up to 100).
4. **Data access**: add the scope `https://www.googleapis.com/auth/spreadsheets`.
5. **Clients → Create client → Web application**. Under **Authorised JavaScript origins** add:
   - `https://patthub.github.io`
   - `http://localhost:8765` (for local testing)
6. Copy the **Client ID** into `config.js` (`clientId`). The Client ID is public by design; no secret is used.

Each team member also needs **edit access** to MASTER.

While the app is in Testing mode, Google shows an "unverified app" screen at sign-in. Choose *Continue*. The screen is expected and does not need app verification for team use.

## Using it

1. Run the prompt for one letter; keep the Word review and `<letter ID>_result.xlsx`.
2. Open the tool, check the MASTER link, and click **Sign in with Google and load**.
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
