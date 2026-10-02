# Architecture

Nishchay is structured as a monolithic React SPA (Single Page Application) backed by a Node.js + Express + SQLite API.

## Module-to-Code Map

| Module (from PRD) | Location |
| :--- | :--- |
| **Auth & Profiles** | `server/api/auth.ts`, `server/api/profiles.ts`, `web/src/pages/AuthPage.tsx` |
| **Instruments (Block 4)** | `server/api/instruments.ts`, `server/api/applications.ts` |
| **Payments (Block 5)** | `server/services/paymentsService.ts`, `server/api/payments.ts` |
| **Field Verification (Block 6)** | `server/api/fieldInspection.ts`, `web/src/pages/FieldVerification.tsx` |
| **Certificates (Block 7)** | `server/services/certificateService.ts`, `web/src/pages/PublicVerify.tsx` |
| **Right-to-check (Block 10)**| `server/api/certificates.ts` (complaint endpoint) |

## Data Model (SQLite)

- **users**: Accounts (Admin, Business, LMO, GATC).
- **businesses**: Registered businesses, mapped to a `user`.
- **instruments**: Registered devices (Make, Model, Class).
- **applications**: Links `business`, `instrument`, and current `state`.
- **payments** & **receipts**: Fee processing tracking.
- **inspections**: Geotagged inspection logs.
- **inspection_photos**: File tracking for evidence.
- **certificates**: Issued digital certificates with ECDSA signatures.
- **audit_log**: Immutable log of state changes.

## Security Model

See `SECURITY.md` for threat models and implemented controls.

## Roadmap for Section 6.2 Modules (Not Built in this Prototype)

The following modules are planned for future phases (V2) but omitted from this SIH Prototype:
1. **Automated Reminders:** Cron jobs to alert users 30 days before certificate expiry.
2. **True Payment Gateway:** Real Razorpay or CCAvenue integration (currently simulated via `paymentsService.ts`).
3. **OCR Integration:** Extracting serial numbers directly from physical device photos to prevent fraud.
4. **Cloud Storage Integration:** Moving from local `/uploads` to S3-compatible cloud storage.
