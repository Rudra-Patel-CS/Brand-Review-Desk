<div align="center">

# 
Brand Review Desk
### Choose a campaign. Review its flags. Record a decision.

An interactive prototype for checking campaign copy against brand rules.

![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)

</div>

## The whole workflow at a glance

![Brand Review Desk quick-start guide: choose a campaign, inspect findings, resolve critical issues, then approve and export](public/assets/readme/brand-review-quickstart.png)

**Start with a demo:** sample campaigns already have example rules and findings. No setup is needed.

**Review your own brand:** you must add your brand’s rules. A logo, product photo, or ad image does not tell the app what your brand allows.

> **Important:** uploaded-image OCR is simulated in this prototype. The app does not actually read text from your uploaded image. The scan, OCR text, confidence values, and resulting finding are examples.

## Try your first review

### 1. Start the app

Install [Node.js 18+](https://nodejs.org/), open a terminal in this project folder, and run:

```bash
npm install
npm start        # API + MongoDB Atlas connection (port 5001)
npm run dev      # web app (port 3000)
```

Open **http://localhost:3000**.

### 2. Create an account and sign in

The portal is gated. The first time you visit, choose **Create Account**, enter a
username, email, and a password of at least 8 characters, then sign in with your
username or email. Accounts are stored in the `users` collection in MongoDB Atlas,
and passwords are hashed with scrypt. Sessions last 7 days and can be ended from the
profile menu → **Sign out**.

### 3. Choose a sample campaign

Open **Review**, then select one of the campaign cards along the top. The app selects that campaign’s demo brand and shows its artwork, caption, and sample findings.

### 4. Understand and resolve a finding

Select a finding or its marker on the artwork to inspect the matched phrase and the rule explanation.

| Button | What happens |
| --- | --- |
| **Apply Suggestion** | Replaces the matched caption phrase when applicable and marks the finding resolved. |
| **Mark Reviewed** | Records a manual review decision. |
| **Dismiss w/ Note** | Opens a note dialog. Saving dismissal is not reliably implemented in this prototype yet. |
| **Undo Decision** | Reopens a resolved finding. |

Critical findings must be resolved before the approval button becomes available.

### 5. Approve and find the review

Click **Approve & Export Review Pack**. In the confirmation dialog, **Download Audit JSON** saves a file. Confirming adds the review to **History**.

## Included demo brands and artwork

The prototype ships with 13 demo brands. Three are original (FreshBites Organic, Arka Foods, NovaTech Solutions) and ten were added for broader compliance coverage:

| Brand | Category | Rules |
| --- | --- | --- |
| Aurora Skin Sciences | Clinical skincare & dermatology | 3 |
| Verdant Home | Eco home care & cleaning | 3 |
| PeakForm Athletics | Performance apparel & supplements | 3 |
| Lumina Bank | Digital banking & payments | 3 |
| TerraTrail Expeditions | Sustainable travel & tourism | 3 |
| ByteBloom Learning | EdTech & career skills | 3 |
| Solstice Beverages | Premium mixers & beverages | 3 |
| Nimbus Cloudworks | Cloud infrastructure & DevOps | 3 |
| Petal & Pine | Baby care & parenting | 3 |
| Forge & Flame | Outdoor kitchens & appliances | 3 |

`data/demo-catalog.json` is the single source of truth for these brands, their 30 rules, and their 10 sample campaigns. The app reads it at build time, and `db.js` upserts it into MongoDB on every server start (idempotent — it never deletes existing data). `npm run seed` also includes it.

Each campaign uses a generated local poster in `public/assets/brands/`. To replace one with a real photo:

1. Put your image in `public/assets/brands/` (for example `aurora.jpg`).
2. Update that campaign’s `imageUrl` in `data/demo-catalog.json` to `/assets/brands/aurora.jpg`.
3. Restart the API (`npm start`) so the campaign is re-upserted, then reload the app.

To regenerate the demo SVG posters after editing `scripts/generate_brand_posters.js`, run `node scripts/generate_brand_posters.js`.

## What about my own brand?

Go to **Rules** and add checks that your organization actually uses. For example:

- Terms or claims that must be flagged
- Required disclosures
- Approved product wording or facts
- A reason and suggested correction for each rule

Use **Test Copy Sandbox** to check a rule against sample text. You can change rules without setting up MongoDB; they are stored in this browser. The included brands and rules are examples, not legal or brand advice.

| Your goal | What to do |
| --- | --- |
| Explore the app | Choose a demo campaign. Existing demo rules are enough. |
| Check your own campaign copy | Add appropriate rules first, then review the caption and supplied text. |
| Upload a logo or brand photo | You can add it as campaign artwork, but it will not create a brand profile or rules. |

## What the other sections do

- **Rules** — search, add, edit, enable/disable, test, export, or reset the demo rules.
- **History** — view reviews saved in this browser.
- **Insights** — explore sample charts. They are not live organization analytics.

<details>
<summary><strong>See the app screen previews</strong></summary>

These are visual previews with sample content.

<p align="center"><strong>Review</strong><br><img src="public/assets/aistudio/screen_5bb56644.png" alt="Mobile preview of the campaign review screen" width="300"></p>
<p align="center"><strong>Rules</strong><br><img src="public/assets/aistudio/screen_6c11f376.png" alt="Mobile preview of the brand rules screen" width="300"></p>

</details>

## What is and isn’t real yet

| Works in the prototype | Demo or not connected yet |
| --- | --- |
| Browse sample brands and campaigns | OCR from an uploaded image (simulated) |
| Match provided caption/OCR text against configured rules | Learning brand rules from a logo or photo |
| Edit rules and try the copy sandbox | Cross-device syncing of reviews and rules |
| Create an account and sign in (stored in MongoDB Atlas) | Password reset and email verification |
| Record sample approvals and view History | React app syncing with the optional MongoDB API |

Rules and review history are saved in the current browser’s local storage. Uploaded campaigns last only for the current app session. Do not use prototype results as a real legal certification or production audit record.

## Developer notes

<details>
<summary><strong>Build, API setup, and project layout</strong></summary>

### Build the web app

```bash
npm run build
npm run preview
```

### Optional Express / MongoDB API

The repository includes an Express API, but it is separate from the React app. Starting it does **not** connect the web interface to MongoDB.

1. Copy `.env.example` to `.env`.
2. Set `MONGO_URI` to your MongoDB connection string. Keep `.env` private.
3. Set `AUTH_SECRET` to a long random string. Generate one with
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
   Rotating it signs every existing session out.
4. Optionally set `DB_NAME` (default `Brand_Review_Desk`), `BACKEND_PORT=5001`,
   `AUTH_TOKEN_TTL` (session seconds, default 604800), and `DNS_SERVERS` if your
   network needs custom resolvers for the Atlas SRV lookup.
5. Run `npm start`; check `http://localhost:5001/api/status`.

Auth endpoints: `POST /api/auth/register`, `POST /api/auth/login`,
`GET /api/auth/me` (Bearer token), and `POST /api/auth/logout`. Every other
`/api` route requires `Authorization: Bearer <token>`.

`npm run seed` replaces demo records in the configured database. Do not run it where existing data must be kept.

```text
src/components/   React screens, navigation, and dialogs
src/data/         Sample brands, campaigns, and reviews
src/utils/        Rule types and compliance matching
data/             demo-catalog.json: added brands, rules, and campaigns
public/assets/    Campaign art, UI references, and README workflow image
server.js         Optional Express API
db.js             MongoDB connection and data operations
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the web app on port 3000 |
| `npm run build` | Build the frontend |
| `npm run preview` | Preview the production build |
| `npm start` | Start the optional API |
| `npm run seed` | Replace demo database records |

</details>

<div align="center">

**For a quick demo, choose a campaign. For your own brand, add your rules first.**

</div>
