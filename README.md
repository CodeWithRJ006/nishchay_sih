# Nishchay

Nishchay is a modernization of the Legal Metrology workflows for weighing and measuring instruments. It shifts from purely paper-based, manual certificates to an end-to-end digital lifecycle: from business registration and instrument profiling to tamper-evident digital certificates and public verification.

## Features (Built & Run)

| Module | Status | Proof |
|---|---|---|
| **Registration** | DONE | `web/src/pages/Register.tsx` |
| **Instrument profile** | DONE | `web/src/pages/Instruments.tsx` |
| **Verification workflow** | DONE | `web/src/pages/field/JobInspection.tsx` |
| **Fee payment** | DONE | `web/src/pages/SandboxCheckout.tsx` |
| **Geo-tagged field verification** | DONE | `web/src/pages/field/CameraCapture.tsx` |
| **Certificate generation** | DONE | `server/api/certificates.ts` |
| **QR public verification** | DONE | `web/src/pages/PublicVerify.tsx` |
| **Right to Check** | DONE | `web/src/pages/PublicVerify.tsx` |
| **Search** | DONE | `web/src/pages/CertificateSearch.tsx` |
| **Reports/export** | DONE | `web/src/pages/CertificateSearch.tsx` |
| **Role dashboards** | DONE | `web/src/pages/OfficerJobs.tsx` |
| **Tamper-evident seal** | DONE | `server/seal/index.ts` |

## Simulated vs. Not-Built
- **Payments:** The payment gateway uses a Sandbox checkout flow instead of real bank APIs.
- **Notifications:** Email and SMS are NOT built.
- **Hardware Integrations:** We do not currently integrate directly with instrument hardware.

## Quick Start

```bash
npm install
npm run build
npm run demo:reset
npm start
```
The server will start on port `4000` (`http://localhost:4000`).

## Demo Logins
All seeded demo logins use the `@nishchay.example` domain. The password for all is `Password123!`.
- **Admin:** `admin@nishchay.example`
- **LMO (Local Metrology Officer):** `lmo1@nishchay.example`, `lmo2@nishchay.example`
- **GATC (Govt Approved Test Centre):** `gatc1@nishchay.example`
- **Businesses:** `biz1@nishchay.example`, `biz2@nishchay.example`, `biz3@nishchay.example`

## Public Verification Route
Certificates can be publicly verified via `http://localhost:4000/v/:publicId`.

## Documentation
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Known Limits](docs/KNOWN_LIMITS.md)
- [Demo Flow](DEMO.md)
