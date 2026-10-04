# Audit Status

- **Module 1 (Registration):** DONE - `web/src/pages/Register.tsx`, `server/tests/auth.test.ts`
- **Module 6 (Instrument profile):** DONE - `web/src/pages/Instruments.tsx`, `server/tests/block4b.test.ts`
- **Module 7 (Verification workflow):** DONE - `web/src/pages/field/JobInspection.tsx`, `server/tests/block6a.test.ts`
- **Module 8 (Fee payment):** DONE - `web/src/pages/SandboxCheckout.tsx`, `server/tests/block5a.test.ts`
- **Module 9 (Geo-tagged field verification):** DONE - `web/src/pages/field/CameraCapture.tsx`, `server/tests/block6b.test.ts`
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
- **Gap d (Architecture, Security, Deployment docs):** DONE - `ARCHITECTURE.md`, `SECURITY.md`, `DEPLOYMENT.md`
- **Phase 6 (Visual Audit & End-to-End Proof):** DONE - `tests/shots.spec.ts` (19/19 tests passing across 1440x900 & 390x844), `scripts/smoke.ts` passing, 4-role switcher verified.
- **Block 10a (Judge's Lab & Evaluation Drawer):** DONE - `web/src/components/JudgesLabDrawer.tsx`, `server/api/demo.ts` (`/api/admin/demo/issue-no-payment` 409 GATE_BLOCKED, `/api/admin/demo/tamper` and `undo-tamper`, `/api/demo/progress`), `server/tests/block10-seed.test.ts`.

