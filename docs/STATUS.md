# Audit Status

- **Module 1 (Registration):** DONE - `web/src/pages/Register.tsx`, `server/tests/auth.test.ts`
- **Module 6 (Instrument profile):** DONE - `web/src/pages/Instruments.tsx`, `server/tests/block4b.test.ts`
- **Module 7 (Verification workflow):** DONE - `web/src/pages/field/JobInspection.tsx`, `server/tests/block6a.test.ts`
- **Module 8 (Fee payment):** DONE - `web/src/pages/SandboxCheckout.tsx`, `server/tests/block5a.test.ts`
- **Module 9 (Geo-tagged field verification):** DONE - `web/src/pages/field/CameraCapture.tsx`, `server/tests/block6b.test.ts`
- **Module 10 (Certificate generation):** PARTIAL - `server/api/certificates.ts`, `server/tests/seal.test.ts` (API tests missing)
- **Module 11 (QR public verification):** PARTIAL - `web/src/pages/PublicVerify.tsx`, `server/tests/seal.test.ts` (API tests missing)
- **Module 12 (Right to Check):** PARTIAL - `web/src/pages/PublicVerify.tsx` (API test missing for complaints)
- **Module 13 (Search):** MISSING - No frontend search implementation or API test.
- **Module 14 (Reports/export):** MISSING - No frontend export implementation or API test.
- **Module 20 (Role dashboards):** DONE - `web/src/pages/OfficerJobs.tsx`, `server/tests/profiles.test.ts`
- **Module 21 (Tamper-evident seal):** PARTIAL - `server/seal/index.ts`, `server/tests/seal.test.ts` (Missing API integration coverage)
- **Gap a (Admin provision LMO/GATC):** DONE - `web/src/pages/AdminProvision.tsx`, `server/tests/profiles.test.ts`
- **Gap b (Minimal GATC dashboard):** DONE - `web/src/pages/OfficerJobs.tsx`, `server/tests/profiles.test.ts`
- **Gap c (Supporting-document upload):** DONE - `server/api/uploads.ts`, `server/tests/block4b.test.ts`
- **Gap d (Architecture, Security, Deployment docs):** DONE - `ARCHITECTURE.md`, `SECURITY.md`, `DEPLOYMENT.md`
