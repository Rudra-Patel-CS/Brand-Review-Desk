# Brand Review Desk

> Editorial compliance workspace for creative ad audits, genuine OCR claim verification, MongoDB GridFS asset storage, and role-based brand governance.

![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.21-black?logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-GridFS-green?logo=mongodb)
![Tesseract](https://img.shields.io/badge/Tesseract.js-OCR-blue)

---

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

## Configuration & Environment Variables

Create a private `.env` file in the project root. **Never commit `.env` or credentials to source control.**

Documented environment variable **names**:

| Variable Name | Description | Default / Example |
| :--- | :--- | :--- |
| `MONGO_URI` | MongoDB Atlas or local MongoDB connection URI | `mongodb://localhost:27017` |
| `DB_NAME` | MongoDB database name | `Brand_Review_Desk` |
| `BACKEND_PORT` | Port for Express API server | `3000` |
| `PORT` | Fallback port for Express API server | `3000` |
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
2. Navigate to `http://localhost:3000`.
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
