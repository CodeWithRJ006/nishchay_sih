# Security & Threat Model

NISHCHAY implements a defense-in-depth security posture designed to eliminate metrology fraud, protect public verification integrity, and prevent administrative or client-side compromise.

## Threat Model & Mitigations

| Threat Actor | Vector | Mitigation Strategy |
| :--- | :--- | :--- |
| **Corrupt Inspector (LMO/GATC)** | Submitting fake off-site inspections | **GPS Enforcement & Haversine Validation (Block 6/C):** Device geolocation is captured at arrival, Haversine distance from registered business premises is validated and stored (`arrived_lat`, `arrived_lng`, `arrived_distance`, `is_demo_location`), and propagated to the inspection record and private seal details. |
| **Malicious Business / Public Visitor** | Modifying database records or certificate parameters | **Tamper-Evident Digital Seal (Block 7/21):** ECDSA P-256 signatures with SHA-256 hashing over canonical JSON. Any DB mutation causes ECDSA signature mismatch or private `detailsDigest` mismatch, rendering the certificate `SEAL_BROKEN` with `integrity: false`. |
| **Unauthorized Visitor / Client** | Invoking demo administration or privilege escalation | **Restricted Demo Mode & RBAC (Block B):** `/api/admin/demo/*` routes are strictly restricted to `ADMIN` role only and return HTTP 404 whenever `DEMO_MODE !== 'true'`. One-click role login (`/api/demo/login-as/:role`) also returns 404 in non-demo mode. |
| **Adversary / Competitor** | Tampering with real production certificates via demo tools | **Strict Allowlist for Tamper Demo (Block B):** The tamper and undo-tamper endpoints only permit modification of the three seeded demo certificates (`sample-cert-val1d-0000`, `sample-cert-exp1r-0000`, `sample-cert-rev0k-0000`). All other certificates reject tampering with HTTP 400. |
| **Unauthenticated Attacker** | Account enumeration & brute-force credential stuffing | **Lockout & Rate Limiting (Block B):** Rate-limited to 30 requests/15m on login and 10 requests/1h on register. Accounts lock after 5 consecutive failures per `(email, client_ip)` with generic timing-safe responses preventing user enumeration. |
| **Malicious Web Page** | Cross-Site Request Forgery (CSRF) | **Double Submit Cookie CSRF (Block B):** Mutating HTTP requests (POST, PUT, DELETE) require a custom `x-csrf-token` header matching the HttpOnly/Lax `csrf` cookie. |
| **Malicious Querier** | SQL Injection via Sort / Filters | **Column Allowlist Query Builder (Block A):** Search and CSV export queries strictly map sort parameters to a static dictionary of validated column identifiers. Order is clamped to `ASC` or `DESC`. Pagination and filter parameters are validated with Zod. |
| **Malicious Payload** | Denial of Service via unhandled async exceptions | **Global Async Error Handling (Block A):** All async Express route handlers are wrapped with `asyncHandler`, piping errors to a centralized error middleware returning `{ code, message, requestId }` without crashing Node. |
| **Corrupted Callback / Replay** | Fee payment fraud or forged treasury callbacks | **HMAC-SHA256 & Timestamp Verification (Block 5/D):** Treasury payment callbacks require a valid HMAC signature over payment payload (returns 401 on mismatch) and reject stale timestamps (> 15m) or future timestamps (> 60s) with HTTP 400. |

## Access Control Matrix (RBAC)

All endpoints are declared in `server/rbac/routeTable.ts` with explicit role permissions. Tested for 100% completeness against mounted Express routes by `server/tests/blockD-completeness.test.ts`.

| Endpoint Path | Method | Allowed Roles | Policy / Constraints |
| :--- | :--- | :--- | :--- |
| `/api/auth/register` | POST | PUBLIC | Rate-limited (10/hr), password >= 8 chars, sequential ID |
| `/api/auth/login` | POST | PUBLIC | Rate-limited (30/15m), lockout after 5 fails per account+IP |
| `/api/auth/logout`, `/api/auth/me` | POST/GET | ALL ROLES | HttpOnly token clearance / user resolution |
| `/api/public/keys` | GET | PUBLIC | SPKI public key retrieval for client-side WebCrypto |
| `/api/public/verify/:publicId` | GET | PUBLIC | Selective disclosure seal verification (no PII returned) |
| `/api/certificates/:publicId` | GET | PUBLIC | Whitelisted public fields only (no owner PII or raw secrets) |
| `/api/certificates/:publicId/pdf` | GET | PUBLIC | Generated A4 PDF with dynamic QR verification code |
| `/api/certificates/:publicId/complaint` | POST | PUBLIC | Zod enum category (`BILLING`, `CALIBRATION`, `TAMPERING`, `OTHER`), 404 on missing cert |
| `/api/certificates/search`, `/export` | GET | BUSINESS, LMO, GATC, ADMIN | Allowlisted query builder; BUSINESS sees only own data |
| `/api/certificates/:id/detail` | GET | BUSINESS, LMO, GATC, ADMIN | Full certificate + inspection photos (scoped by owner/officer) |
| `/api/instruments` | POST/GET | BUSINESS | Registered instruments belonging to authenticated business |
| `/api/applications` | POST/GET | BUSINESS | Applications and supporting documents |
| `/api/payments/initiate` | POST | BUSINESS | Initiates sandbox payment with exact fee match |
| `/api/payments/callback` | POST | HMAC | Webhook verified by HMAC signature & timestamp window |
| `/api/appointments/schedule` | POST | BUSINESS | Allowed only after fee payment verification |
| `/api/appointments/accept`, `/reject` | POST | LMO, GATC | Restricted to assigned officer in jurisdiction |
| `/api/field/jobs/:id/arrive` | POST | LMO, GATC | Captures GPS, calculates Haversine distance, records audit |
| `/api/field/jobs/:id/inspection` | POST | LMO, GATC | Atomic transaction: inspection + certification + upload |
| `/api/admin/demo/*` | ALL | ADMIN only | 404 when `DEMO_MODE !== 'true'`; tamper restricted to 3 sample IDs |
| `/api/demo/login-as/:role` | POST | ALL (Demo only) | 404 when `DEMO_MODE !== 'true'`; rate-limited (60/15m) |

## Rate Limits & Denial of Service Protection

- **Auth Login (`/api/auth/login`):** 30 requests per 15 minutes window.
- **Auth Register (`/api/auth/register`):** 10 requests per 1 hour window.
- **Public & Verification (`/api/public/*`, `/api/certificates/*`):** 60 requests per 1 minute window.
- **Demo Role Switching (`/api/demo/login-as/:role`):** 60 requests per 15 minutes window.
- **Demo Reset (`/api/admin/demo/reset`):** In-process table truncation and reseeding, strictly rate-limited to 1 request per 30 seconds.
- **File Uploads (`/api/upload`, `/api/field/jobs/:id/inspection`):** Capped at 5 MB per file with magic-byte validation (JPEG, PNG, PDF only) and SHA-256 integrity verification.

## Secrets Management & Environment Isolation

- `JWT_SECRET` and `HMAC_SECRET` are evaluated lazily via `server/config/secrets.ts`.
- In production (`NODE_ENV === 'production'` and `DEMO_MODE !== 'true'`), the server strictly refuses to boot if `JWT_SECRET` or `HMAC_SECRET` is unset (exits with code 1).
- In development/test mode, safe development fallbacks are provided to ensure consistent unit test execution.
- Single storage path helper `storageDir()` resolves paths from `STORAGE_DIR` env variable or defaults to `<cwd>/storage/uploads`, eliminating path divergence between inspection ingestion and seal verification.

## Tamper Demo Security Controls

- The demo tamper tool modifies the `public_record` JSON column in SQLite to visually prove that the cryptographic seal detects unauthorized changes.
- To prevent abuse during evaluations:
  1. Only `ADMIN` role can invoke tamper or undo-tamper endpoints.
  2. The endpoint rejects any certificate ID outside `ALLOWED_SAMPLE_IDS` (`sample-cert-val1d-0000`, `sample-cert-exp1r-0000`, `sample-cert-rev0k-0000`) with HTTP 400. Real or newly issued certificates cannot be altered by the demo tamper endpoint.
  3. Original records are backed up in a `certificate_tamper_backup` table to allow clean atomic restoration via `/api/admin/demo/undo-tamper`.
