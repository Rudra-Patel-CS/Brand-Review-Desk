# Brand Review Desk

> Editorial compliance workspace for creative ad audits, genuine OCR claim verification, MongoDB GridFS asset storage, and role-based brand governance.

![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.21-black?logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-GridFS-green?logo=mongodb)
![Tesseract](https://img.shields.io/badge/Tesseract.js-OCR-blue)

---

## Public Judge Demo

The GitHub Pages workflow builds a no-login, browser-only demo for judges. It opens directly into the sample workspace, supports rule-based copy review, local Tesseract OCR, creative upload, workflow actions, review history, and JSON exports. Demo changes are temporary and remain in page memory; no account or database is used. Uploaded creative images and OCR processing stay in the browser.

Intended public URL (available after Pages is enabled and the workflow succeeds):

`https://rudra-patel-cs.github.io/Brand-Review-Desk/`

The deployment workflow is configured in this repository, but the live URL is not confirmed until the repository owner enables Pages and a deployment succeeds. One-time repository setup: in **Settings → Pages**, set the source to **GitHub Actions**, then run or push to the `main` branch. The workflow token cannot enable Pages for a repository where Pages has never been configured.

For a local preview of the same no-login build:

```bash
VITE_PUBLIC_DEMO_MODE=true npm run build
npm run preview -- --host 127.0.0.1
```

The normal server-backed build retains its authenticated login and MongoDB workflows.

### Public demo scope and limitations

- The GitHub Pages build sets `VITE_PUBLIC_DEMO_MODE=true`; it bypasses sign-in for this static demo only. It does not expose or disable authentication on the normal server-backed deployment.
- The public demo uses in-memory browser state. Uploaded creative, OCR results, rule edits, findings, decisions, approvals, and exports are not sent to a backend and are lost when the page is reloaded.
- Caption and OCR text findings come from the configured deterministic rules. The app does not independently verify factual claims, evidence, legal compliance, trademarks, or visual brand requirements.
- Tesseract.js performs actual browser OCR on uploaded raster artwork; confidence and boxes come from OCR output. OCR can miss or misread text. Safe-zone checks compare available OCR boxes with configured format zones and are guidance only; visual layout, contrast, logo placement, and platform rendering still require human inspection.
- Sample archive entries are illustrative, have no genuine reviewer attestation or sample hash, and are explicitly labeled. A hash created during the public demo is a local content digest, not a server-side signature.

### GitHub Pages deployment

1. In the repository settings, open **Pages** and select **GitHub Actions** as the source.
2. Push to `main` or run **Actions → Deploy public demo → Run workflow**.
3. Wait for the workflow to complete successfully, then open the URL above in a private/incognito window. Confirm the workspace opens without a sign-in screen and exercise review, OCR, decisions, approval, and export.
4. If Pages is unavailable or the workflow has not completed, use the Actions run as the deployment status source; do not treat the intended URL as a verified live link.

No MongoDB URI, password, or other application credential is required by the static demo workflow. For a server-backed deployment, configure MongoDB and authentication secrets only in the hosting provider's secret manager/environment; never put them in Vite variables or client-side source. Vite-exposed values are public.

## Architecture & Features

### 1. Secure Authentication & Role-Based Access Control (RBAC)
- **First-Admin Bootstrap:** Secure setup endpoint (`POST /api/auth/bootstrap`) that allows creating the initial administrator **only** when the database contains zero users.
- **Closed Registration:** Public self-registration is automatically disabled once the first administrator has been bootstrapped. Subsequent users must be provisioned by an administrator.
- **Password Security:** Passwords hashed using `bcrypt` (12 salt rounds) with backward-compatible verification for legacy scrypt hashes.
- **Server-Managed Sessions & Cookies:** Authenticated sessions stored in MongoDB `sessions` collection (with in-memory fallback), delivered via `HttpOnly`, `SameSite=Lax` cookies (`Secure` in production). Authentication tokens are **never** stored in `localStorage` or `sessionStorage`.
- **CSRF Protection:** State-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) authenticated by cookie require a cryptographically random `X-CSRF-Token` header.
- **Brute-Force Rate Limiting:** Login attempts are rate-limited per IP address to safeguard against credential stuffing.
- **Immediate Disabling Enforcement:** Disabled accounts are immediately blocked (HTTP 403 Forbidden) and active sessions revoked.
- **Review Identity Auditing:** Final review sign-offs permanently bind the authenticated reviewer's identity and role rather than relying on placeholder strings.

#### Role Permissions Matrix
| Role | View Workspace | Re-audit & Correct OCR | Upload Campaigns & Assets | Manage Brand Rules | Approve & File Reviews | User Management |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Reviewer** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Approver** | ✅ | ✅ | ✅ | ✅ (Create/Edit) | ✅ | ❌ |
| **Admin** | ✅ | ✅ | ✅ | ✅ (Full + Delete) | ✅ | ✅ |

---

### 2. Campaign Image Storage in MongoDB GridFS
- **Asset Storage:** Campaign creative artwork uploaded through `POST /api/assets/upload` is stored in the MongoDB GridFS bucket (`campaign_assets`).
- **Access Control:** Image assets are retrieved via `GET /api/assets/:id` with strict authentication checks, HTTP caching (`ETag`, `Cache-Control: private`), and `X-Content-Type-Options: nosniff`.
- **Magic-Byte Content Validation:** File contents are inspected for true image signatures (`image/png`, `image/jpeg`, `image/webp`, `image/gif`) rather than trusting user-supplied file extensions or MIME types.
- **Upload Size Limit:** 15MB maximum file size limit enforced at both multer and storage layers.
- **Reference Preservation:** Existing external URLs, demo catalog presets, and the 10 source-attributed Wikimedia Commons reference records are preserved with full license and author links.

#### Idempotent Base64 to GridFS Migration Utility
If legacy database documents contain base64 data URLs:
```bash
# Dry-run inspection without modifying database records:
node scripts/migrate_base64_to_gridfs.js --dry-run

# Execute non-destructive migration:
node scripts/migrate_base64_to_gridfs.js
```
The migration script is idempotent: it parses valid base64 image strings, checks for existing GridFS assets, migrates them to the `campaign_assets` bucket, updates campaign documents with `assetId`, and preserves records if any step fails.

---

### 3. Real Optical Character Recognition (OCR) Engine
- **Engine:** Powered by `tesseract.js` using local English language training assets (`vendor/lang/eng.traineddata.gz`) for deterministic, offline-capable execution.
- **No Mock or Fabricated Data:** The engine reads real raster pixels from uploaded campaign images, returning genuine detected text tokens.
- **Genuine Confidence Scores:** Displays real confidence percentages (0-100) provided by the OCR engine. If no text or confidence is reported, confidence is reported as 0 rather than inventing artificial scores.
- **Accurate Percentage Bounding Boxes:** Parses image dimensions from PNG/JPEG/WebP headers or OCR layout metadata and accurately scales pixel bounding boxes (`{ x0, y0, x1, y1 }`) to percentage coordinates (`{ top, left, width, height }`). Bounding boxes are never fabricated when coordinates are absent.
- **Human Verification & Manual Corrections:** Users can open the Artwork OCR Review modal to review raw extracted text, manually correct misread tokens, and save `correctedArtworkText`.
- **Database Persistence & Smart Caching:** Both `extractedText` and `correctedArtworkText` are persisted in MongoDB workspace campaigns. Campaigns reopen instantly with saved text without rerunning OCR on polling cycles.
- **Compliance Rules Integration:** Enabled brand rules loaded from MongoDB evaluate against both caption copy and active artwork text (`correctedArtworkText || extractedText`), dynamically pinpointing matching OCR bounding boxes.
- **OCR Transparency Statement:** Clearly informs reviewers:
  > *Optical Character Recognition (OCR) may miss, misread, or truncate artwork text depending on font typography, contrast, or image compression. Automated OCR text extraction is not a legal compliance certification. Reviewers must review extracted text and can manually correct results at any time before final sign-off.*

---

### 4. Review Workflow, Co-Approval & Event Audit Trail
- **Workflow State Machine:** Governs transitions between clear states: `draft` → `in_review` → `changes_requested` / `approved` / `rejected`. Re-opening approved reviews is restricted to administrators.
- **Role-Enforced Transitions:** Reviewers can submit campaigns for review and request revisions; approvers and administrators execute final approval or rejection.
- **Co-Approval & Self-Approval Prevention:** Users who created or submitted a campaign cannot approve their own work unless an explicit administrator policy permits it.
- **Critical Finding Override Justification:** Approving a creative with open critical compliance findings strictly requires a written override reason, which is permanently saved on the campaign and logged as a distinct audit event.
- **Idempotent Chronological Event Logging:** Every state transition, comment, submission, and sign-off generates an event in MongoDB `events` collection (`campaignId`, `user`, `actionType`, `timestamp`, `details`). Network retries with `idempotencyKey` return existing events without duplicating records.
- **Review Audit Export:** Users can download the complete review audit trail in structured JSON via `GET /api/workspace/campaigns/:id/export`.

---

### 5. Platform Safe-Zone & Visual Layout Guidance
- **Verified Platform Specifications:** Verified specifications for Instagram (Reels 9:16, Feed Portrait 4:5, Square 1:1), TikTok (In-Feed Video 9:16), YouTube (Shorts 9:16), and LinkedIn (Single Image 1.91:1, Square 1:1) stored in `src/data/platformSpecs.json`.
- **Official Documentation Sources & Verification Dates:** Every platform format specification includes its official documentation URL (e.g. Meta Business Help Center, TikTok for Business, YouTube Help, LinkedIn Marketing Solutions) and verification date (`2026-02-15`).
- **Asset Dimension & Aspect-Ratio Comparison:** Inspects actual image width, height, and aspect ratio, comparing against recommended format targets:
  - Exact Specification Match
  - Aspect Ratio Matches Target
  - Aspect Ratio Mismatch (with warning of letterboxing/pillarboxing)
  - Unsupported / Custom Format handling without breaking
- **Visual Safe-Zone Overlays:** Semi-transparent tinted overlays visually demarcate areas obscured by platform UI elements (camera buttons, right-side action rails, bottom captions, and CTA buttons). Users can toggle overlays ON or OFF.
- **Obscured Region Detection:** Cross-references OCR bounding boxes and open compliance claims with platform safe zones to warn reviewers when disclaimers or logos fall into obscured interface zones.
- **Layout Guidance & Transparency Disclaimer:**
  > *Platform safe-zone analysis provides layout guidance based on official creative guidelines (verified 2026-02-15) and does not guarantee final platform rendering across all client device viewports.*

---

### 6. Database-Backed Agency Scorecards & Analytics
- **Zero Synthetic Numbers:** Replaced simulated multipliers with real-time aggregation queries against saved MongoDB campaign and event records.
- **Key Compliance Metrics:** Computes total campaigns, review outcomes (approval rate, rejection rate), finding resolution rate, and dual detection distribution (caption copy vs artwork OCR).
- **Turnaround Time from Real Timestamps:** Measures true elapsed duration between review submission events and final approval/rejection timestamps, calculating average turnaround speed.
- **Multi-Dimensional Filters:** Filter analytics by Brand, Agency, Review Status, and Date Horizon (`7d`, `30d`, `90d`, `ytd`, `all`).
- **Sample vs Real Data Segregation:** Distinct toggle to include or exclude sample / demo presets (such as Wikimedia Commons references). Clearly displays counts of sample vs production records.
- **Agency Compliance Scorecards:** Evaluates vendor agency rosters on campaigns handled, approval rate, critical finding rate, and average turnaround time, assigning performance grades (A, B, C, Pending).
- **Cross-Brand Benchmarking:** Compares compliance clearance rates and defect frequencies across brand portfolios.
- **Graceful Insufficient Data State:** When zero records match filters, clearly explains that data is limited and provides guidance rather than fabricating fake statistics.
- **Authentic CSV and JSON Export:** Dedicated export endpoints (`GET /api/workspace/analytics/export?format=csv` and `format=json`) generate downloadable audit ledgers.

---

## Configuration & Environment Variables

Create a private `.env` file in the project root. **Never commit `.env` or credentials to source control.**

Documented environment variable **names**:

| Variable Name | Description | Default / Example |
| :--- | :--- | :--- |
| `MONGO_URI` | MongoDB Atlas or local MongoDB connection URI | `mongodb://localhost:27017` |
| `DB_NAME` | MongoDB database name | `Brand_Review_Desk` |
| `BACKEND_PORT` | Port for Express API server | `5000` |
| `PORT` | Fallback port for Express API server | `5000` |
| `AUTH_SECRET` | Secret key used for session cryptographic signatures | *(Set random string)* |
| `AUTH_TOKEN_TTL` | Session duration in seconds | `604800` (7 days) |
| `DNS_SERVERS` | Custom DNS resolvers for MongoDB Atlas SRV lookup (optional) | `8.8.8.8,1.1.1.1` |

---

## Local Development & Setup

### Prerequisites
- Node.js 18+ (tested on Node 20 and Node 24)
- npm 9+
- MongoDB 6.0+ (Atlas cluster or local instance)

### Installation
```bash
git clone https://github.com/Rudra-Patel-CS/Brand-Review-Desk.git
cd Brand-Review-Desk
npm install
```

### Initial Administrator Bootstrap
1. Start the server:
   ```bash
   npm start
   ```
2. Navigate to `http://localhost:3000` (Vite frontend; Express API defaults to port `5000`).
3. Because the database contains 0 users, the portal automatically presents the **First-Admin Bootstrap** form.
4. Enter an administrator username, email, and strong password (minimum 8 characters).
5. Once submitted, the initial administrator account is created with the `admin` role and the portal automatically locks public registration.

### Running Development
```bash
# Start backend API (handles auth, GridFS assets, OCR endpoints, and MongoDB sync):
npm start

# In a separate terminal, start Vite frontend with HMR:
npm run dev
```

---

## Testing & Verification

Run the comprehensive automated test suite (includes rules engine, authentication/sessions/RBAC, GridFS storage, and real OCR processing):

```bash
# Run all automated tests:
npm test

# Run TypeScript type verification:
npx tsc --noEmit

# Run Vite production build:
npm run build
```

The test runner utilizes `tsx --test` to execute:
- `src/utils/rulesEngine.test.ts`: Brand rule patterns, compliance scoring, caption remedies.
- `tests/auth.test.ts`: Admin bootstrap, login rate limiting, session cookies, CSRF protection, RBAC permission enforcement, and account disabling.
- `tests/storage.test.ts`: Magic byte detection, GridFS upload/retrieval, size limits, unauthorized rejection, and Wikimedia Commons preservation.
- `tests/ocr.test.ts`: Tesseract OCR extraction, genuine confidence scoring, percentage bounding-box scaling, SSRF URL restrictions, MongoDB text persistence, and user correction re-auditing.
- `tests/workflow.test.ts`: Workflow state machine transitions, role permissions, self-approval policy restrictions, critical finding override reasons, chronological audit event persistence, idempotency, and review export.
- `tests/safeZone.test.ts`: Platform format specifications, official documentation links, verified dates, dimension and aspect ratio comparison, safe-zone coordinate scaling, obscured region detection, and unsupported format handling.
- `tests/analytics.test.ts`: Database metrics calculation, genuine turnaround times from real timestamps, multi-dimensional filtering, sample/demo segregation, empty/insufficient data states, agency scorecards, and CSV/JSON export.
