# Brand Review Desk - Team 24CS073 (CodeNexus India 2026, Round 2)

Check every piece of content against the approved brand rules before it goes live.
Content goes in, it is checked against the loaded guidelines/terms/facts, every issue
is explained with the exact rule it breaks, and a human makes the final decision.

## Run it

No build step, no install. Two ways:

1. **Serve the folder (recommended, enables the on-device creative scan).**

   **Windows - easiest (VS Code):**
   - Right-click the ZIP -> Extract All.
   - Open the extracted `brand-review-desk` folder in VS Code.
   - Install the free "Live Server" extension (by Ritwick Dey).
   - Right-click `index.html` -> "Open with Live Server". Done.

   **Windows - Python:**
   - Install Python from python.org (tick "Add python.exe to PATH" during setup).
   - Right-click the ZIP -> Extract All, then open the extracted `brand-review-desk` folder.
   - In the folder address bar type `powershell` and press Enter.
   - Run: `py -m http.server 8000`  (if `py` is missing, use `python -m http.server 8000`)
   - Open http://localhost:8000 in the browser. Keep the window open while using the app.

   **Mac/Linux:** `cd brand-review-desk && python3 -m http.server 8000`, then open http://localhost:8000.

   Any static server works (npx serve, nginx, GitHub Pages, Netlify...).

2. **Just open index.html** - caption/text checks, rules editing, history and export all work.
   The creative (poster) text scan needs a web origin because browsers block Web Workers on
   file:// pages; in that case the app says so plainly and sends the creative to manual review.
   Nothing is ever auto-passed.

Everything runs locally. No account, no API key, no network needed after download
(the OCR engine is vendored in /vendor). Uploaded images never leave the device.

## What is real

- **Rule engine** (`engine.js`): the loaded ruleset is the only thing that fires flags.
  Edit rules on the Brand Rules page, import your own JSON, and the checks respond.
  Every flag carries the rule ID, the exact matched text and the rule's source quote/version.
- **Creative text scan**: Tesseract.js OCR runs in the browser (sparse-text mode, 2x upscale),
  returns word-level bounding boxes, and the red dashed outline on the creative is drawn
  from the actual OCR result - not a fixed overlay.
- **Linked caption**: checked as text; matched phrases are highlighted in place and fixes
  apply directly to the caption.
- **Human decision flow**: apply a suggestion, queue a creative copy change (the app never
  edits poster pixels - approved wording is handed to design in the export report), or
  dismiss with a logged reason. Approve & Export downloads a review report (txt + json)
  and writes the audit record to History.
- **Persistence**: rules, draft and history are stored in localStorage on the device.

## Honest limits (by design, stated in the UI too)

- Checked: caption text and text detected on the creative, against the loaded rules
  (claims, tone, terminology - whatever rules you load).
- Not auto-checked: colours, layout, logo placement and other purely visual rules.
  Those go to manual review. OCR on heavily stylized type can be imperfect; low-confidence
  scans are labeled as hints, not verdicts.

## Files

- `index.html`, `styles.css`, `app.js` - the app (plain JS, commented, editable)
- `engine.js` - the check engine (pure logic; also runs in Node for tests)
- `data/default-rules.json` / `.js` - the demo Arka Foods ruleset (fictional demo brand)
- `assets/arka-poster.png` - fictional demo creative
- `vendor/` - Tesseract.js runtime (MIT), fully offline
