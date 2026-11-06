# Brand Review Desk (MongoDB Edition) - Team 24CS073

Check every piece of content against approved brand rules before it goes live.
Content goes in, it is verified against brand guidelines, terminology, and approved facts, every issue is cited with the exact source rule it breaks, and a human reviewer makes the final decision.

---

## What's New in this Version

- **MongoDB Database Integration**:
  - Replaces manual JSON import/export with direct MongoDB Atlas storage.
  - Connected to MongoDB cluster `project-1.xzfwn9j.mongodb.net`, database `Brand_Review_Desk`.
  - Collections ("tables") created and managed:
    - `rulesets`: Stores comprehensive brand rulebooks and approved facts.
    - `rules`: Normalized rule documents with pattern indexing and toggling.
    - `reviews`: Immutable compliance audit trail for every signed-off campaign.
    - `drafts`: Active and saved content drafts (posters, captions, OCR tokens).
    - `brands`: Multi-brand profiles and brand-specific rule sets.
    - `audit_logs`: Granular change log of reviewer actions.
  - Offline-first resilience: seamless fallback store if the network is disconnected, with automatic re-syncing.
- **Brand Selector**: Switch dynamically between brand profiles and their dedicated rulebooks (e.g., *Arka Foods*, *NovaTech Solutions*).
- **Interactive Rule Tester**: Real-time pattern tester inside the rule editor modal to test regex and phrase matching against sample copy before saving.
- **Real-Time Compliance Analytics & Insights**: Live dashboard aggregating total reviews, compliance rate, top flagged rules, and category distributions directly from MongoDB.
- **Review Filters**: Filter issues by Severity (High, Medium, Low), Status (Open, Resolved), or Source (Caption vs Creative).
- **Interactive Bounding Box Spotlight**: Click any detected issue or poster outline to highlight the exact phrase and its rule card.
- **Multiple Demo Draft Presets**: Quick-switch between Festive Poster, Health Claim Social Ad, and Flash Sale Offer.

---

## Run it

### Option 1: Full-Stack with Express & MongoDB (Recommended)

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start the server**:
   ```bash
   npm start
   ```
3. Open **`http://localhost:3000`** in your browser.

The server connects to MongoDB Atlas using the configured `.env` URI, exposes REST endpoints at `/api/...`, and serves the frontend application.

### Option 2: Static Server / Live Server

You can also run any local HTTP server:
- In VS Code: Right-click `index.html` -> "Open with Live Server".
- Python: `python -m http.server 8000` -> open `http://localhost:8000`.

---

## Database Architecture

| Collection | Purpose | Schema Key Fields |
| :--- | :--- | :--- |
| **`rulesets`** | Complete brand rulebooks | `brand`, `rulesetName`, `version`, `rules[]`, `approvedFacts[]` |
| **`rules`** | Individual indexed rules | `id`, `name`, `category`, `severity`, `patterns[]`, `regex`, `why`, `suggestion`, `source`, `enabled` |
| **`reviews`** | Audit trail of approved content | `reviewId`, `contentName`, `brand`, `decisions[]`, `copyChanges[]`, `finalCaption`, `timestamp`, `status` |
| **`drafts`** | Content drafts & OCR text | `name`, `kind`, `imageUrl`, `caption`, `brand`, `ocr`, `updatedAt` |
| **`brands`** | Brand profiles | `name`, `industry`, `description`, `rulesCount`, `createdAt` |
| **`audit_logs`** | Granular event audit logs | `event`, `targetId`, `timestamp`, `details` |

---

## File Structure

- `server.js` - Express backend server with MongoDB REST API routes
- `db.js` - MongoDB Atlas driver connector, collection initializers & seeding
- `index.html` - App shell, brand switcher, and database status card
- `styles.css` - Modern styling, typography, responsive layout, animations
- `app.js` - Frontend controller, live API sync, filter engine, modal handlers
- `engine.js` - Rule check engine, pattern matching, OCR bounding box mapping
- `vendor/` - Vendored Tesseract.js runtime (MIT), 100% offline OCR
- `data/` - Default demo ruleset and facts
- `assets/` - Demo posters and brand assets

---

## Honest Scope & Limits

- **Automated**: Text checks on captions and poster OCR text (claims, tone, terminology, pricing disclosures).
- **Human Decision**: Visual rules (layout, colors, typography) require visual review; poster pixels are not altered automatically. Approved copy changes are handed to the design team in the exported report.
