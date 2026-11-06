# Submission notes - Round 2 (draft for the official form/PDF)

## Completed features
1. Content draft intake: poster/creative upload + linked caption (demo draft preloaded, fictional brand "Arka Foods (demo)").
2. Editable, importable brand ruleset (claims, tone, terminology) with source doc/version/quote per rule.
3. Explainable checks: every flag carries rule ID, exact matched quote and rule source; flags map to the caption span or the on-creative OCR bounding box.
4. On-device OCR creative scan (Tesseract.js, sparse-text mode) with word-level boxes; low-confidence scans labeled; no auto-pass.
5. Human decision flow: apply suggestion (caption), queue creative copy change for design re-export, dismiss with logged reason; manual-review lane for what cannot be auto-checked.
6. Approve & Export: review report (txt + json) with decisions, queued copy changes and final approved caption.
7. Audit history persisted on-device; rules/draft persistence; mobile-responsive UI.

## Technology
Plain HTML/CSS/JS (no build step) + vendored Tesseract.js (MIT) for on-device OCR. Rules engine is
pure JS and unit/integration-tested in Node; browser flows tested with headless Chrome (desktop + mobile).
Zero external services, keys or accounts; works fully offline over any static server.

## Changes made to the original Round 1 plan
- Stack simplified from Next.js + NestJS + PostgreSQL to a dependency-free static app, so a judge can open
  and use the core workflow with no setup, no accounts and no deployment dependency.
- LLM-API check pipeline replaced by a transparent, rule-based engine + on-device OCR: no keys, no cost,
  no data leaves the device, and every flag still quotes its exact rule source as planned.
- Role-based workspaces (creator/manager/reviewer) and retrieval over a vector store are deferred to Round 3
  (demo scale does not need retrieval; direct rule matching is exact at this size).

## Three major improvements planned for Round 3
1. Recurring-flag analytics: which brand rules get flagged most, so the guidelines themselves improve.
2. Role-based workspaces: creator, manager and reviewer queues with assignments (from the Round 1 plan).
3. Visual-rule checks via a vision model: contrast, safe zones and logo usage on the creative itself,
   wired through the same cited-flag pipeline (requires a configured provider, disclosed policy).
