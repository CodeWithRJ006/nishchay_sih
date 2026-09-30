# NISHCHAY Prototype Plan

You are the lead engineer building the PROTOTYPE of NISHCHAY: a digital verification and certification platform for weighing and measuring instruments under India's Legal Metrology regime, for Smart India Hackathon problem statement SIH26036 (Dept of Consumer Affairs). It will be screen-recorded and judged by a strict jury, and also opened live by judges. Reliability, clarity and visual quality matter more than breadth. It proves one trust loop end to end: register > apply > pay > inspect > certify > publicly verify.

## SOURCE OF TRUTH
docs/source/NISHCHAY_Project_Summary_v4.docx (Section 6.1 = prototype scope). Build ONLY these modules: 1 Registration, 6 Instrument profile, 7 Verification workflow, 8 Fee payment and e-receipt gate, 9 Geo-tagged field verification (responsive web view), 10 Certificate generation, 11 QR public verification, 12 Right to Check, 13 Search, 14 Reports/export (certificate PDF + one CSV), 20 Role dashboards (basic), 21 Tamper-evident seal. Plus gap fixes: (a) admin-provisioned LMO and GATC accounts with profile screens, (b) minimal GATC dashboard, (c) supporting-document upload on applications, (d) docs/ARCHITECTURE.md, SECURITY.md, DEPLOYMENT.md. Do NOT build Section 6.2 modules (2-5, 15-19), expiry reminders, renewal, notifications, real payments, OCR, risk scoring. Do not stub them in the UI. If a request conflicts with the document, stop and ask.

## HONESTY RULES
- Seal proves a record was not altered after capture. It does NOT prove the original observations were true. Say so in UI help text.
- Fee-gate removes the officer's control over the official fee transaction. It does NOT stop off-book payments. Never claim otherwise.
- QR verification is a standard pattern; our contribution is live status + rule logic + selective-disclosure seal.
- Label everything simulated: sandbox payment, sandbox OTP, demo GPS, demo camera, synthetic data, demo fees and tolerances.
- Footer on every page: "Prototype built for SIH26036. Not an official government system." No government emblem or "Government of India" branding. All data synthetic.

## STACK (fixed; do not substitute)
- Node 22 LTS. ONE package.json at repo root. NO npm workspaces. NO Prisma. NO separately built shared package.
- Folders: server/ (Express 4 + TypeScript run by tsx, better-sqlite3 with plain SQL migrations in server/migrations/*.sql, zod, pino, helmet, express-rate-limit, jsonwebtoken in httpOnly cookie, bcryptjs, multer, pdf-lib, qrcode), web/ (Vite + React 18 + TypeScript + Tailwind CSS 3.4 + React Router + TanStack Query + react-hook-form + zod + lucide-react + qr-scanner; fonts self-hosted via @fontsource: Bricolage Grotesque, Source Sans 3, JetBrains Mono; no CDN at runtime), shared/ (pure TypeScript, NO node: imports, imported by both via relative path or alias; rules, state machine, canonical JSON, id formats, zod schemas).
- Node-only code (crypto signing, keys, PDF) lives in server/.
- Scripts must work on Windows, macOS and Linux (use cross-env, no bash-only syntax). Required scripts: dev, build, start, lint, typecheck, test, verify, demo:setup, demo:reset, preflight, shots.
- `npm start` runs the server in production mode and serves web/dist plus the API on ONE port (4000). Dev: Vite on 5173 proxying /api to 4000.
- If DEMO_MODE=true and the database is empty or the seal key does not match, the server seeds itself on boot (so ephemeral hosting works).
- Vitest + Supertest for unit and API tests. Playwright for three E2E tests only: golden path, tamper demo, 390x844 field flow. No other test frameworks.
- .gitignore from day one: node_modules, dist, *.tsbuildinfo, playwright-report, test-results, .keys, storage, *.db*, .env. Never commit generated files or scratch scripts. No console.log, no unused dependencies, no TODO in shipped code.

## DOMAIN RULES
- Roles: BUSINESS, LMO, GATC, ADMIN. Deny by default. All routes declared in ONE route table with {method, path, roles, objectPolicy}; a test fails if any mounted route is missing from it. Business sees only own data; officers only their zone and assignments; admin sees all.
- shared/rules.ts: instrument classes {code, label, validityMonths, routing: "LMO"|"GATC", baseFeeDemo, tolerancesDemo, sourceNote, verified}. Ship: Weights, Length measure, Capacity measure, Counter machine, NAWI class III up to 150 kg (routing GATC). Fees and tolerances are DEMO values, labelled. Anything not confirmed against legal text gets verified:false and is listed in docs/RULES_TO_VERIFY.md. No rule logic outside this file.
- One instrument per application. Application type NEW only.
- IDs from a counter table inside a transaction: instrument NSH-I-######, application NSH-A-YYYY-######, receipt NSH-R-YYYY-######, certificate NSH-C-YYYY-######.
- Time via clock.now() from shared (injectable in tests). Status EXPIRED when now > validTo. No reminders or renewal.

## STATE MACHINE (one transition() function; anything unlisted is rejected)
DRAFT -submit-> SUBMITTED (fee snapshotted)
SUBMITTED -payment_succeeded-> PAID | -cancel-> CANCELLED
PAID -schedule-> SCHEDULED (slot chosen; officer auto-assigned by routing class, zone, daily capacity, least load, deterministic tie-break)
SCHEDULED -officer_accept-> ACCEPTED | -officer_reject(reason)-> PAID (reassign; if none, admin "unassigned" queue)
ACCEPTED -inspection_pass-> INSPECTED_PASS | -inspection_fail(reasons)-> FAILED
INSPECTED_PASS -issue_certificate-> CERTIFIED
Any state before ACCEPTED -admin_cancel-> CANCELLED

## FEE-GATE
issueCertificate runs in ONE transaction and requires: state INSPECTED_PASS; exactly one PAID payment for this application and instrument; receipt HMAC valid; receipt amount equals fee snapshot; receipt not linked to another certificate. certificates.receipt_id is NOT NULL UNIQUE in SQL. Any violation returns 409, writes audit GATE_BLOCKED, changes nothing. Scheduling also requires PAID.

## SEAL (selective disclosure; must verify both on server and in the browser)
- Public record (signed): {v:1, certificateNo, instrumentId, tradeName, instrumentClass, serialNo, validFrom, validTo, authorityName, receiptDigest, detailsDigest}.
- Private details (never public): officer id, GPS, distance, checklist, readings, photo records, receipt info. detailsDigest = SHA-256 of canonical JSON of the private details, which include each photo's SHA-256.
- Canonical JSON: keys sorted recursively, no whitespace, NFC strings, ISO-8601 UTC, reject NaN/Infinity/undefined. Implemented in shared/ (pure) so the browser can use it.
- hash = SHA-256 hex of canonical public record. signature = ECDSA P-256 over UTF-8 "nishchay-seal-v1:"+hash, produced with Node crypto using dsaEncoding "ieee-p1363" (required so WebCrypto in the browser can verify it). Key generated on first run into .keys/ (gitignored); keyId = first 8 hex of SHA-256 of the SPKI public key. Public key at GET /api/public/keys. Document the KMS/HSM production path.
- Server verification: recompute hash, verify signature, recompute detailsDigest from stored details AND re-hash every photo file. Any mismatch = "Seal broken". Browser verification (WebCrypto) checks hash + signature on the public record: "Verified in your browser".
- Live status per request: Seal broken > REVOKED > EXPIRED > VALID.
- QR encodes only {PUBLIC_BASE_URL}/v/{publicId} (128 random bits, base32). Nothing else.
- Public API exposes only: trade name, instrument type, serial, status, validity dates, authority name, integrity result, four trust ticks, the public record + signature + keyId. Never phone, email, address, fees, notes, officer identity, GPS.

## SECURITY BASELINE
zod on every input; central error handler {code, message, requestId}, no stack traces; helmet strict CSP; cookie HttpOnly SameSite=Lax (Secure in production); CSRF via required custom header on mutating requests; rate limits on auth and public endpoints; uploads JPEG/PNG/PDF only with magic-byte check, 5 MB cap, random names, no path traversal; escape user text everywhere including PDF and CSV (formula-injection guard); append-only audit_log written in the same transaction as each change; DB constraints (unique keys, transactions) enforce idempotency, not check-then-insert.

## UX DIRECTION "Graduated" (a first-time user with no training must finish every task)
- Palette CSS variables + Tailwind tokens: Gauge Steel #EEF2F5 bg, Ink #0D1B26 text, Calibration Blue #0F4C81 primary, Verified Green #0B7A5A, Stamp Amber #B7791F (fills only; use #8A5A00 for amber TEXT so it passes AA), Seal-Break Red #B3261E.
- Fonts: Bricolage Grotesque headings, Source Sans 3 UI, JetBrains Mono for IDs and hashes only.
- Motif: measurement-scale tick marks for progress and timelines. One bold moment: the Verification Plate on the public page (status stamp + four ticks: Fee receipt, Officer on site, Checklist recorded, Seal intact; ticks light in sequence once; if integrity fails the last tick breaks and the plate turns red).
- Every screen has: one clear page title, one sentence saying what this screen is for, ONE primary action, and a "Next step" banner naming what happens next. Buttons name the action ("Pay fee", "Submit inspection"). Errors say what happened and what to do. Plain words, no unexplained jargon (explain Legal Metrology once on the home page). Sentence case, left aligned, no all-caps eyebrows, no gradient washes, no identical-card grids everywhere, no exclamation marks.
- In DEMO_MODE every form has an "Fill demo details" button.
- Quality floor: responsive from 360px, AA contrast, visible focus, 44px touch targets, prefers-reduced-motion respected, semantic HTML, labels on inputs, skeleton loaders, designed empty and error states, no layout shift, no horizontal scroll.
- No map tile services (no network dependency). Distance to premises is drawn as a small inline SVG diagram.

## WORKING RULES
1. Each block: restate the plan in 5 lines, build API and UI together, run `npm run verify` until green, run the app, open it (browser agent or `npm run shots`), view your own screenshots at 390px and 1440px, fix visual defects, update docs/PROGRESS.md (max 20 lines), commit with a clear message, then print at most 10 lines: what works, how to run it, the MANUAL TEST steps for me, known issues. Then stop. Do not start the next block.
2. Never weaken a test, add retries, or mark something done without running it. If something is broken, say so plainly.
3. Keep files small (under 300 lines), one component per file, service layer for rules, thin route handlers.
