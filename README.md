<div align="center">

# Brand Review Desk

### A focused workspace for reviewing creative campaigns against brand rules.

Review campaign copy, inspect compliance findings, manage rulebooks, and keep a local review archive in a responsive React interface.

![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-required-339933?logo=nodedotjs&logoColor=white)

</div>

---

<div align="center">

[Overview](#overview) · [Quick start](#quick-start) · [Features](#features) · [Optional API](#optional-express--mongodb-api) · [Project layout](#project-layout)

</div>

## Overview

Brand Review Desk is a responsive campaign-review prototype. It includes sample campaigns for **FreshBites Organic**, **Arka Foods**, and **NovaTech Solutions**, plus a rule-based compliance review workflow.

> **Current app behavior:** the React interface uses built-in demo data. Brand rules and review history are saved in the browser's `localStorage`. The Express/MongoDB API is a separate optional service and is not currently connected to the React interface.

## Quick start

### Requirements

- Node.js 18 or newer
- npm

### Run the React app

```bash
npm install
npm run dev
```

Open **http://localhost:3000**.

No MongoDB account or `.env` file is needed to explore the React app.

### Build for production

```bash
npm run build
npm run preview
```

Vite serves the production build locally after the build completes.

## Features

| Workspace | What you can do |
| --- | --- |
| **Review** | Select demo campaigns, inspect rule findings, edit copy, and record review decisions. |
| **Brand rules** | Browse, add, edit, enable, disable, reset, and export rules. |
| **History** | Review saved demo decisions and export review records. |
| **Insights** | Explore demo compliance summaries and export analytics data. |
| **Campaign intake** | Add an image and campaign details to the current session. |

The compliance engine evaluates campaign captions and supplied OCR text against enabled, brand-specific regular expressions. The interface includes example OCR text and findings; **image text extraction is currently simulated rather than performed by a live OCR engine**. Treat generated findings, review attestations, and analytics as prototype data—not legal advice or a production audit record.

## Optional Express / MongoDB API

The repository also includes an Express API backed by MongoDB. This service is independent of the React app at present; starting it does not make the React screens use MongoDB.

### Configure the API

1. Copy `.env.example` to `.env`.
2. Set `MONGO_URI` to a MongoDB connection string you control.
3. Keep the database name in `DB_NAME` (defaults to `Brand_Review_Desk`) and set the API port to `BACKEND_PORT=5001`.

Keep `.env` private. It is ignored by Git; do not put database credentials in source files or documentation.

### Start the API

```bash
npm start
```

The API listens on **http://localhost:5001** when `BACKEND_PORT=5001` is set. Check the database/API status with:

```bash
curl http://localhost:5001/api/status
```

The response reports whether MongoDB connected. If it did, `connected` is `true`; otherwise, the API reports fallback status.

### Seed demo records (optional)

```bash
npm run seed
```

**Warning:** seeding clears and replaces the `brands`, `rules`, `rulesets`, `campaigns`, `drafts`, and `reviews` collections in the configured database. Back up any data you need before running it.

### API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/status` | Database connection and collection status |
| `POST` | `/api/connect` | Re-check the database connection |
| `GET`, `POST` | `/api/ruleset` | Read or save the active ruleset |
| `POST` | `/api/ruleset/reset` | Restore the default ruleset |
| `GET`, `POST` | `/api/draft` | Read or save a draft |
| `GET`, `POST` | `/api/reviews` | List or add reviews |
| `DELETE` | `/api/reviews/:id` | Delete a review |
| `GET` | `/api/brands` | List brands |
| `GET` | `/api/insights` | Read insight summaries |

## Data and privacy

- The React prototype stores rules and review history in the current browser profile's `localStorage`.
- Campaigns and other initial screen content are bundled demo data.
- The optional API uses MongoDB only when configured and started separately.
- Never commit `.env` or use real customer data in the prototype.

## Project layout

```text
src/
  components/       React screens and dialogs
  data/             Demo brands, campaigns, and review records
  utils/            Compliance rule types and matching engine
scripts/
  seed_mongodb.js   Optional MongoDB demo-data seeder
server.js           Optional Express API
db.js               MongoDB connection and API data operations
vite.config.ts      Vite, React, Tailwind, and /api proxy configuration
```

## npm scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server on port `3000` |
| `npm run build` | Create the production client build |
| `npm run preview` | Preview the production build locally |
| `npm start` | Start the Express API server |
| `npm run seed` | Replace demo records in the configured MongoDB database |

---

<div align="center">

Built for clearer, more explainable campaign reviews.

</div>
