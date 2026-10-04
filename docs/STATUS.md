# Prototype Implementation & Audit Status

## Security and Correctness Hardening (Audited & Verified)

- **Block A (Availability & Injection Elimination):** DONE - Proven by `server/tests/blockA-injection-crash.test.ts`
  - Async unhandled error crash protection with global Express error handler returning `{ code, message, requestId }`.
  - SQL injection eliminated via strict column allowlist mapping and Zod validation for search and CSV export query builders.
- **Block B (Authentication, Access Control & Exposure):** DONE - Proven by `server/tests/blockB-auth-security.test.ts`
  - `/api/admin/demo/*` strictly scoped to `ADMIN` and disabled (404) unless `DEMO_MODE === 'true'`.
  - In-process demo database reset replacing `execSync('npm run demo:reset')`, rate-limited to 1 per 30 seconds.
  - Public certificate endpoint whitelisted strictly to non-confidential public fields.
  - Rate limiting on login (30/15m), register (10/1h), and demo switch.
  - Account lockout after 5 consecutive failures per `(email, ip)` with generic timing-safe error messages.
  - Deterministic sequential IDs for users (`USR-0001`) and businesses (`BIZ-0001`).
  - CSP hardened: dropped `'unsafe-eval'` and external Google Fonts.
  - Double-submit CSRF cookie protection.
  - Lazy configuration secrets with boot refusal in production when secrets are unset.
- **Block C (Field Verification Integrity & Unified Storage):** DONE - Proven by `server/tests/blockC-field-integrity.test.ts`
  - Single central `storageDir()` helper in `server/config/paths.ts` ensuring newly issued certificate photos and verifier read from identical path (`storage/uploads`), eliminating false `SEAL_BROKEN` seal integrity failures.
  - Arrived distance: Real GPS capture, Haversine distance calculation from business coordinates, `arrived_lat`, `arrived_lng`, `arrived_distance`, and `is_demo_location` saved to `appointments` and propagated to `inspections`.
  - Validation: Readings validated with Zod (min 3 readings, finite numbers, valid physical ranges) and checklist verification.
  - Atomic transaction: Inspection save + application transition (`ACCEPTED` -> `INSPECTED_PASS`) + certificate issuance executed in a single atomic database transaction. Any issuance failure rolls back state to `ACCEPTED` with no orphaned inspection.
- **Block D (Smaller Defects & Completeness):** DONE - Proven by `server/tests/blockD-completeness.test.ts`
  - Payment callback returns HTTP 401 on missing or invalid HMAC signature, and HTTP 400 on stale (> 15m) or future (> 60s) timestamps.
  - Complaints category validated via Zod enum (`BILLING`, `CALIBRATION`, `TAMPERING`, `OTHER`) and returns HTTP 404 if certificate does not exist.
  - `instrumentType` in `verifyCertificatePublic` and `getCertificatePublic` derived as human-readable label from `shared/rules.ts` (e.g. "Weights").
  - Complete automated route-table test verifying 100% of mounted Express API routes have explicit RBAC declarations in `routeTable.ts`.

## Core Modules & Prototype Scope

- **Module 1 (Registration):** DONE - `web/src/pages/Register.tsx`, `server/tests/auth.test.ts`
- **Module 6 (Instrument profile):** DONE - `web/src/pages/Instruments.tsx`, `server/tests/block4b.test.ts`
- **Module 7 (Verification workflow):** DONE - `web/src/pages/field/JobInspection.tsx`, `server/tests/block6a.test.ts`
- **Module 8 (Fee payment):** DONE - `web/src/pages/SandboxCheckout.tsx`, `server/tests/block5a.test.ts`
- **Module 9 (Geo-tagged field verification):** BUILT & AUDITED - `web/src/pages/field/CameraCapture.tsx`, `server/tests/block6b.test.ts`, `server/tests/blockC-field-integrity.test.ts` (Mobile web view with real Haversine distance validation, dual photo capture, magic-byte checks, and photo SHA-256 digests. Geolocation uses browser API with a labeled demo location bypass for reviewers).
- **Module 10 (Certificate generation):** DONE - `server/api/certificates.ts`, `server/tests/block9.test.ts`
- **Module 11 (QR public verification):** DONE - `web/src/pages/PublicVerify.tsx`, `server/tests/block9.test.ts`
- **Module 12 (Right to Check):** DONE - `web/src/pages/PublicVerify.tsx`, `server/tests/block9.test.ts`
- **Module 13 (Search):** DONE - `web/src/pages/CertificateSearch.tsx`, `server/tests/block9.test.ts`
- **Module 14 (Reports/export):** DONE - `web/src/pages/CertificateSearch.tsx`, `server/tests/block9.test.ts`
- **Module 20 (Role dashboards):** DONE - `web/src/pages/OfficerJobs.tsx`, `server/tests/profiles.test.ts`
- **Module 21 (Tamper-evident seal):** DONE - `server/seal/index.ts`, `server/tests/sealFull.test.ts`, `server/tests/block9.test.ts`
- **Gap a (Admin provision LMO/GATC):** DONE - `web/src/pages/AdminProvision.tsx`, `server/tests/profiles.test.ts`
- **Gap b (Minimal GATC dashboard):** DONE - `web/src/pages/OfficerJobs.tsx`, `server/tests/profiles.test.ts`
- **Gap c (Supporting-document upload):** DONE - `server/api/uploads.ts`, `server/tests/block4b.test.ts`
- **Gap d (Architecture, Security, Deployment docs):** DONE - `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md`
- **Phase 6 (Visual Audit & End-to-End Proof):** DONE - `tests/shots.spec.ts`, `scripts/smoke.ts` passing, 4-role switcher verified.
- **Certificate PDF & Live QR Scan:** DONE - `server/services/certificatePdfService.ts` authoritative A4 certificate design with official borders, status badge, cryptographic seal panel, and dynamic QR code encoding live host/`PUBLIC_BASE_URL` (`/v/:publicId`). Tested via `server/tests/pdf-qr.test.ts`.
- **Honesty & Clarity Audit Resolution:** DONE
  1. **Port Unified:** Single unified port 4000 (Express API + Vite static dist). Port 3000 eliminated.
  2. **Demo Email Domain:** All demo users use `@nishchay.example`. Zero `.gov.in` addresses exist in git.
  3. **Payment Labeling:** Sandbox payment checkout (simulated treasury receipt with HMAC verification). Zero occurrences of "Dummy Gateway".
  4. **Notifications Honest Disclosure:** Notifications are NOT BUILT (no external SMS/email gateway, no notification DB table). In-app state toasts only.
  5. **Clean Repository:** `PROJECT_SUMMARY.md` deleted, `uploads/` ignored in `.gitignore`, `cookie.txt` removed from git.
  6. **Tamper-Evident Pitch:** Accurately termed "tamper-evident", not "tamper-proof". The seal proves whether a record was modified after issuance; it does not prevent DB updates or prove truthfulness of initial observations.
