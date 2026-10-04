# Known Limits

This document outlines the known technical and functional limitations of the current Nishchay prototype.

## Technical Limits

1. **SQLite Concurrency:** The system relies on `better-sqlite3`. While fast for reads, heavy concurrent write loads will hit disk I/O bottlenecks.
2. **Local Storage Ephemerality:** File uploads (inspection photos) are saved to `storageDir()` (configured via `STORAGE_DIR`, defaulting to `storage/uploads`). In cloud PaaS environments (like Render free tier) without persistent disk mounts, newly uploaded inspection photos disappear upon container spin-down.
3. **Session Management:** JWTs are stateless in httpOnly cookies. If an admin revokes an account, the user will remain logged in until their current JWT expires (1 day), unless cross-checked with a blacklist table on every request.
4. **GPS Spoofing:** The browser's Geolocation API is trusted verbatim (with a simulated Hyderabad premises demo toggle for judges). A native mobile app with OS-level hardware attestation is required for production field enforcement.

## Functional Limits

1. **No External SMS/Email:** Notifications are NOT built. Real-time feedback is communicated via in-app toast alerts.
2. **Statutory Rules Verification:** Validity is computed via `computeValidTo` from `shared/src/rules.ts` (12 or 24 months by class). Specific period assignments (e.g. 12 vs 24 months for Weights and Length Measures) remain cataloged in `docs/RULES_TO_VERIFY.md` pending statutory Gazette schedule verification.
3. **Sandbox Payments Only:** There is no connection to commercial banks or real UPI gateways. Payment initiation and HMAC-signed webhook callbacks are fully simulated in a local sandbox.
4. **Boot Behavior & Production Secrets:** In production (`NODE_ENV === 'production'` and `DEMO_MODE !== 'true'`), the service strictly refuses to boot if `JWT_SECRET` or `HMAC_SECRET` is unset. In `DEMO_MODE === 'true'`, lazy demonstrator fallback secrets are used to allow zero-config prototype evaluation.
5. **Ephemeral Hosting & Automatic Seeding:** In `DEMO_MODE=true`, if the database is missing or cryptographic keys change, the server automatically runs plain SQL migrations and seeds demonstrator accounts and sample certificates on boot.
