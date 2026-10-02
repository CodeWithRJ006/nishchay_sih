# Project Summary: Nishchay - Legal Metrology Certificate System

This document is generated for Claude to understand the full context, architecture, history, and current state of the Nishchay project.

## 1. Project Context & Requirements
- **Goal:** Build a prototype for SIH26036 (Smart India Hackathon).
- **Core Functionality:** A digital system for the Legal Metrology Department to register weighing/measuring instruments, schedule inspections, perform geo-tagged field verification, issue cryptographically verifiable certificates, and allow public verification (right-to-check).
- **Strict Scope (from `PLAN.md`):** Only Section 6.1 features are built. No real payments, no OCR, no physical biometrics.

## 2. Tech Stack
- **Frontend:** React 18 (SPA), React Router v6, Tailwind CSS, Vite.
- **Backend:** Node.js (v24), Express, better-sqlite3.
- **Security & Crypto:** Argon2 (passwords), JWT (cookies, CSRF protected), ECDSA (`node:crypto` with P-256 for signing certificates).
- **PDF Generation:** `pdf-lib` for certificate downloads.
- **Testing/Tooling:** Vitest (backend unit/integration), Playwright (UI snapshots), ESLint, TypeScript.

## 3. Database Schema (`storage/nishchay.db`)
- `users`: (id, email, password_hash, role)
- `businesses`: (id, owner_id, name, address, lat, lng, zone_id)
- `instruments`: (id, business_id, make, model, serial, class)
- `applications`: (id, business_id, instrument_id, state ['SUBMITTED', 'PAID', 'ASSIGNED', 'INSPECTED_PASS', 'INSPECTED_FAIL', 'CERTIFIED'], fee_amount)
- `payments`, `receipts`: (For strict fee-gate integration)
- `appointments`: (application_id, officer_id, scheduled_date)
- `inspections`: (application_id, officer_id, lat, lng, distance_m, pass, notes)
- `certificates`: (id, public_id, application_id, public_record, signature, status ['VALID', 'REVOKED'])
- `audit_log`: Immutable history of state changes via SQLite triggers.

## 4. Frontend Routes & Pages Structure
- `/` (`Home.tsx`): Landing page. Public certificate verification search (redirects to `/v/:id`).
- `/login` (`Login.tsx`): Auth login and Demo mode quick login.
- `/register` (`Register.tsx`): Business account creation.
- `/dashboard/*` (`DesktopShell.tsx` layout):
  - **Business:** `BusinessProfile.tsx`, `Instruments.tsx`, `InstrumentProfile.tsx`, `ApplicationWizard.tsx`, `SandboxCheckout.tsx`, `ReceiptPage.tsx`, `ApplicationSchedule.tsx`.
  - **LMO/GATC (Officers):** `OfficerProfile.tsx`, `OfficerJobs.tsx` (view assigned jobs).
  - **Admin:** `AdminFinance.tsx`, `AdminUnassigned.tsx`, `AdminProvision.tsx`.
- `/field/*` (`MobileFieldShell.tsx` layout):
  - Mobile-first interface for LMOs.
  - `JobList.tsx`, `JobDetail.tsx`, `JobInspection.tsx` (captures GPS, verifies distance, uploads photos).
- `/v/:id` (`PublicVerify.tsx`): Public verification page (Right to Check). Decodes `public_record`, verifies seal status, allows downloading PDF and submitting consumer complaints.

## 5. Recent Fixes & Critical Issues Resolved
- **Issue:** The public verification route `/v/:id` was returning 404 because `PublicVerify.tsx` wasn't mapped in `App.tsx` or built. 
  **Fix:** Created `PublicVerify.tsx` and mapped it to `/v/:id` in `App.tsx`.
- **Issue:** The Demo login buttons on `/login` were broken. 
  **Fix:** Added the `/api/demo/login-as/:role` endpoint in `demo.ts` and whitelisted it in the RBAC `routeTable.ts`.
- **Issue:** SQLite transactions were failing during tests (`cannot start a transaction within a transaction`). 
  **Fix:** Removed rogue `COMMIT;` from migration files (`007-block7.sql`) and added `DROP TABLE IF EXISTS` to handle `001-init.sql` conflicts.
- **Issue:** Fee Gate logic in unit tests was failing because of missing mock data.
  **Fix:** Updated `block6b.test.ts` to insert exact `fee_amount` matches in `payments` and HMAC signed `receipts`.
- **Issue:** `preflight.ts` checked the wrong port (3000 instead of 4000) and wrong DB path (`local.db` instead of `storage/nishchay.db`). 
  **Fix:** Corrected paths and ports in the script.

## 6. Current Status & Known Issues
- The prototype is structurally complete. All unit tests (`npm run test`) and typechecks pass.
- Playwright took screenshots (`npm run shots`) successfully.
- Code is running on Port 4000 via `npm run start` (production mode) or Port 5173/4000 via `npm run dev`.
- **Vercel Deployment:** The user wants to deploy to Vercel easily. **Note for Claude:** This repo uses a custom Express server + SQLite which is inherently stateful. Vercel is serverless (read-only file system). Deploying SQLite to Vercel will result in the DB resetting on every request, and image uploads to local disk will fail. Claude should either provide a `vercel.json` that ignores the backend and deploys only the Vite frontend (mocking APIs), or advise migrating to a PostgreSQL database for a true Vercel/NextJS style deployment. For now, the codebase is monolithic.

## Instructions for Claude
The user expects you (Claude) to review this summary and provide prompts/instructions on how to make the build "perfect" and how to properly deploy it to Vercel given the SQLite/Express architecture. Please read the Current Status and propose the next architectural or deployment steps.
