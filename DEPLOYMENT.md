# Deployment Guide — Brand Review Desk (Server-Backed Mode)

This guide deploys the full Express + MongoDB application (authentication, durable
campaigns/rules/reviews/evidence, GridFS artwork storage, backup/restore) on a
**₹0 stack**: MongoDB Atlas M0 (free) + Render free web service.

> The static no-login demo (GitHub Pages / the Round 2 demo link) needs none of this.
> This guide is for the persistent, account-based deployment.

## 1. MongoDB Atlas (free M0 cluster)

1. Create a free account at <https://cloud.mongodb.com> and an **M0 (Free)** cluster.
2. **Database Access:** create a database user (e.g. `brd-app`) with a generated
   password. Store the password somewhere safe.
3. **Network Access:** add `0.0.0.0/0` (required for Render's dynamic IPs).
4. Copy the connection string:
   `mongodb+srv://brd-app:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority`

## 2. Render web service (free tier)

1. In Render: **New → Web Service →** connect the GitHub repository.
2. Settings:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
   - **Environment:** Node
3. Environment variables (Render dashboard → Environment):

   | Key | Value | Notes |
   |---|---|---|
   | `MONGO_URI` | your Atlas connection string | never commit this |
   | `DB_NAME` | `Brand_Review_Desk` | or your choice |
   | `SESSION_SECRET` | long random string | session cookie signing |
   | `VITE_PUBLIC_DEMO_MODE` | `false` | enables the login screen |
   | `SHOW_DEMO_CREDENTIALS` | `true` | shows the judge demo account on the login screen (hackathon only) |
   | `DEMO_USER_EMAIL` | `demo@brandreview.desk` | optional override |
   | `DEMO_USER_PASSWORD` | strong demo password | optional override |

   `render.yaml` in this repo encodes the same service shape for **New → Blueprint**.

4. Deploy. First load runs against an empty database and shows the **bootstrap**
   screen to create the first administrator.

## 3. Seed the workspace (rules, brands, campaigns, evidence, demo account)

```bash
export MONGO_URI='your Atlas connection string'
export DB_NAME='Brand_Review_Desk'
npm run seed
```

The seed is idempotent for the demo account and populates rules, rulesets, brands,
campaigns, reviews, and the **evidence library** (with current/expired/no-expiry
records). It also creates the judge demo account:

- **Email:** `demo@brandreview.desk` (or `DEMO_USER_EMAIL`)
- **Password:** `DemoReview!2026` by default — set `DEMO_USER_PASSWORD` when seeding.

With `SHOW_DEMO_CREDENTIALS=true`, these credentials appear on the login screen so
judges can sign in directly. **Disable this flag for any real deployment.**

## 4. Free-tier notes

- Render free services sleep after inactivity; the first request after idle can
  take ~30–60s (cold start). This is expected and acceptable for the demo.
- Atlas M0 limits: 512 MB storage, shared RAM. Well within demo needs.
- Uploaded artwork lives in GridFS (`campaign_assets` bucket), max 15 MB per file.

## 5. Backup & restore

Admin-only JSON routes (also usable with `curl` and the demo admin session):

- **Export:** `GET /api/backup/export` → downloads a full workspace backup
  (`brands`, `rules`, `rulesets`, `campaigns`, `reviews`, `drafts`, `events`,
  `evidence`, `users`; sessions are excluded).
- **Restore:** `POST /api/backup/import` with body `{ "backup": <exported JSON>, "confirm": true }`.
  Restore **replaces** current collections; the `confirm` flag is mandatory.
  Payloads are validated (format tag, version, known collections) before any write.

## 6. Security checklist

- Keep `MONGO_URI`, `SESSION_SECRET`, and `DEMO_USER_PASSWORD` in Render's
  environment settings only — never in source or `VITE_*` variables.
- Set `SHOW_DEMO_CREDENTIALS=false` (or unset) outside the hackathon demo.
- The demo account is a full admin; delete it after judging if the deployment stays up.
- A legacy fallback connection string exists in `db.js` for local development.
  Set `MONGO_URI` explicitly in every deployed environment so it is never used,
  and rotate that legacy password when convenient.
