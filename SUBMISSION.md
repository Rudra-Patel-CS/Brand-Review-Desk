# Brand Review Desk — Round 3 Submission

## Project and links

- **Source repository:** [Rudra-Patel-CS/Brand-Review-Desk](https://github.com/Rudra-Patel-CS/Brand-Review-Desk)
- **Live demo (no login):** [https://brand-review-desk.onrender.com/](https://brand-review-desk.onrender.com/) — opens directly into the sample workspace; no account needed.
- **Server-backed deployment (optional, full persistence + judge login):** follow [DEPLOYMENT.md](DEPLOYMENT.md). When deployed with `SHOW_DEMO_CREDENTIALS=true`, the judge demo account appears on the login screen itself (email `demo@brandreview.desk`), so judges can sign in without any setup.

## What the product does

Brand Review Desk reviews advertising content before publication for brand-rule compliance. A reviewer works with a caption and artwork, sees every rule violation with its exact rule citation, matched text, severity, and a proposed correction, then makes the human decision: apply, queue a creative fix, dismiss with a documented reason, or mark manually reviewed. Nothing is auto-approved: final sign-off is always human, and every decision lands in an audit trail.

## Round 2 → Round 3: the three committed improvements, completed

### 1. Evidence library for approved claims (completed)

- `src/utils/evidenceLibrary.ts` + an **Evidence Library block inside every finding card** (under the action buttons).
- Each flagged claim is matched to substantiation records — certificates, lab reports, policies, terms, registrations — each with an optional **expiry date**.
- Badges: green `Expires <date>` (current), amber `Expiring <date>` (within 30 days), red `Expired <date>`, neutral `No expiry` for standing links.
- A claim with **no evidence shows an amber dashed "Missing" row** and is **flagged for human review before approval**; expired evidence is flagged the same way. Evidence never auto-clears a claim.
- The public demo runs the library in memory with seeded records (current, expiring, expired, and missing states are all visible out of the box). The server mode persists evidence in MongoDB via `/api/evidence` routes (approver/admin write, reviewer read).

### 2. Durable backend with backup & restore (completed, deploy-ready)

- The existing Express/MongoDB backend (sessions, RBAC, GridFS artwork, workflow, ~40 routes) gained:
  - **Evidence CRUD routes** (`GET/POST/PUT/DELETE /api/evidence`).
  - **Backup & restore:** `GET /api/backup/export` downloads the full workspace as validated JSON (brands, rules, rulesets, campaigns, reviews, drafts, events, evidence, users; sessions excluded); `POST /api/backup/import` restores it, but only with `confirm: true` and after format/version/collection validation.
- [DEPLOYMENT.md](DEPLOYMENT.md) documents the ₹0 deployment (MongoDB Atlas M0 + Render free tier), and `render.yaml` ships a matching Blueprint. `npm run seed` populates rules, campaigns, evidence, and the judge demo account.
- The no-login demo keeps working with zero backend as a fallback.

### 3. Visual checks from real pixels (completed)

- `src/utils/visualChecks.ts` analyzes the actual artwork on a client-side canvas:
  - **Contrast:** WCAG relative-luminance ratios measured inside OCR text regions (pass ≥ 4.5:1; large-text review band 3–4.5:1; fail < 3:1; uniform regions honestly reported as not measurable).
  - **Logo presence:** normalized cross-correlation template matching against an uploaded reference logo at multiple scales (pass ≥ 75% correlation; 45–75% routed to human review).
  - **Clear space:** edge distance from the detected logo to the nearest text element or artwork edge, against a half-logo-height minimum.
  - **Text visibility:** rollup of region contrast and OCR confidence; widespread low contrast routes to human review.
- Results render as **PASS / FAIL / HUMAN REVIEW chips** in the Visual Checks card above the audit findings and as matching chips on the poster viewport.
- No AI or certification claims: methods and thresholds are documented next to the results, and every uncertain outcome goes to a human.
- Validated against **labelled synthetic fixtures** (high-contrast label, washed-out label, logo present/absent, crowded/spacious logo, corrupt input) in `tests/visualChecks.test.ts`.

## Also fixed or finished this round

- **Round 2 bug fixed:** uploaded artwork dimensions are now captured at upload time via `createImageBitmap`, so the aspect-ratio check runs on freshly uploaded creatives (previously it silently could not run).
- The placeholder "planned feature v2.6" modal was removed and replaced with an honest in-app **Product Roadmap** (delivered vs planned).
- Approval filing is guarded against double submission; visual-check runs are re-entrant (double-click safe); corrupted dates/files degrade to human-review states instead of errors.
- README now includes clone-and-run steps, Render deployment notes, and the product roadmap.

## Technology and implementation

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS 4. Evidence matching and visual analysis are deterministic, client-side modules with pure, Node-testable cores.
- **Public demo:** static build with `VITE_PUBLIC_DEMO_MODE=true`; all state in browser memory; Tesseract.js OCR runs locally.
- **Server-backed application:** Node.js/Express 4, MongoDB 6 driver + GridFS, cookie sessions with CSRF protection, bcrypt password hashing, role-based access (admin/approver/reviewer), evidence and backup/restore routes.
- **OCR:** Tesseract.js 7 (browser and server paths).

## Verification record (Round 3)

- `npx tsc --noEmit` — passed.
- `npm test` — passed (**97 tests**: rules engine, download helper, analytics, auth, OCR, safe zones, storage, workflow, **+ evidence library (12), visual checks (12), backup/restore + evidence API (10)**).
- `npm run build` — production build passed.
- Browser verification (headless Chrome against the production build): visual checks run and render chips; reference-logo upload re-scores the logo and clear-space checks; evidence badges (Missing / Expired / Expires / No expiry) render per finding; uploaded creative shows captured dimensions in the aspect-ratio badge; double-clicking actions and reloading the page leave the app in a clean state.

## Honest scope

- Rule matching checks configured patterns only; it does not independently verify facts. The evidence library links claims to records a human filed — it does not fetch or judge the documents itself.
- Visual checks are decision support with documented thresholds, not legal certification; low-confidence outcomes are routed to reviewers.
- The public demo is in-memory by design (changes reset on reload); persistence requires the server deployment in DEPLOYMENT.md.
- Render's free tier sleeps when idle (cold start ~30–60s on first hit).
