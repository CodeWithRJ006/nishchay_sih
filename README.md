# NISHCHAY (निश्चय)
### Digital Verification & Certification Platform for India's Legal Metrology Regime
**Smart India Hackathon 2024 — Problem Statement SIH26036**  
*Department of Consumer Affairs, Government of India*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-nishchay--sih.onrender.com-brightgreen?style=for-the-badge&logo=render)](https://nishchay-sih.onrender.com)
[![Status](https://img.shields.io/badge/System%20Status-Healthy%20200%20OK-blue?style=for-the-badge)](https://nishchay-sih.onrender.com/api/health)
[![Playwright Tests](https://img.shields.io/badge/Playwright%20Audit-19%2F19%20Pass-success?style=for-the-badge)](https://nishchay-sih.onrender.com)

> 🌐 **Live Application URL:** [https://nishchay-sih.onrender.com](https://nishchay-sih.onrender.com)  
> 🏥 **Health Check Endpoint:** [https://nishchay-sih.onrender.com/api/health](https://nishchay-sih.onrender.com/api/health)  
> 🧪 **Live Valid Certificate:** [https://nishchay-sih.onrender.com/v/sample-cert-val1d-0000](https://nishchay-sih.onrender.com/v/sample-cert-val1d-0000)

> **SIH Prototype Notice:**  
> Prototype built for SIH26036. Not an official government system. No government emblem or official branding is used. All data, merchant profiles, coordinates, fees, and test readings are synthetic.

---

## 1. Executive Summary & Problem Solved

Under India's **Legal Metrology Act, 2009** and the **Legal Metrology (General) Rules, 2011**, millions of commercial weighing and measuring instruments (retail scales, petrol dispensers, weighbridges, length measures) must undergo periodic physical verification by Local Metrology Officers (LMOs) or Government Approved Test Centres (GATCs).

Today, this process suffers from:
- Paper certificates susceptible to physical forgery and tampering.
- Officer discretion in issuing certificates prior to official fee payments.
- Disconnected inspection records with no permanent cryptographic tie between test readings, on-site photographs, and the issued certificate.
- Inability for consumers or enforcement inspectors to instantly verify authenticity in the field.

**NISHCHAY** implements an end-to-end, tamper-evident digital verification lifecycle that proves one statutory trust loop:
$$\text{Register} \longrightarrow \text{Apply} \longrightarrow \text{Pay (Fee-Gate)} \longrightarrow \text{Schedule} \longrightarrow \text{Inspect (390px Field)} \longrightarrow \text{Certify} \longrightarrow \text{Public Verify (WebCrypto)} \longrightarrow \text{Right to Check}$$

---

## 2. Key Capabilities & "Wow" Moments

### ⚡ 1-Click Interactive Role Switcher
Reviewers can instantly evaluate all 4 user personas directly from the navigation bar without logging out:
- **BUSINESS (Merchant):** Register instruments, submit applications, pay statutory fees via simulated e-receipt, track status, view receipts, and download certificates.
- **LMO (Legal Metrology Officer):** View assigned queue, accept/reject appointments, perform geo-tagged field verification at 390×844 on mobile, capture photos, record load test readings against legal tolerances, and certify.
- **GATC (Govt Approved Test Centre):** Handle industrial instruments (e.g. NAWI Class III up to 150 kg) with specialized testing workflows.
- **ADMIN (State Regulator):** Manage unassigned queues, assign officers, monitor live audit feeds, review consumer disputes, inspect financial reconciliation, and provision officer accounts.

### 🧪 Judge's Lab (Interactive Evaluation Drawer)
A dedicated slide-out drawer accessible from any screen (desktop and mobile) that proves the system's security guarantees live:
1. **Fee-Gate Bypass Refusal:** Attempts to issue a certificate without an official paid receipt. Triggers an immutable database refusal (`HTTP 409 Conflict`, `code: 'GATE_BLOCKED'`) and logs audit telemetry.
2. **Cryptographic Seal Tamper Demo with Undo:** Alters the public record of a valid certificate in the database. When viewed on `/v/sample-cert-val1d-0000`, browser-side WebCrypto immediately detects the tampered signature, turning the Verification Plate red ("Seal broken"). Tap **Undo** to instantly restore the legitimate seal.
3. **Statutory Trust-Loop Checklist:** Live tracking of all 7 statutory milestones with completion indicators.
4. **Factory Demo Reset:** 1-click restore to clean, realistic seeded data for reproducible testing.

### 🛡️ Dual-Verification Cryptographic Seal
- **Public Record (Signed):** Canonical JSON containing certificate number, instrument ID, merchant name, serial, validity window, issuing authority, and cryptographic digests.
- **Private Inspection Details (Hashed):** Officer identity, GPS coordinates, premises radius distance, inspection checklist answers, calibration load readings, and SHA-256 digests of all captured photos.
- **Browser-Side WebCrypto Validation:** Digital signatures are generated using **ECDSA P-256** with IEEE P1363 curve encoding. When any citizen or judge opens a certificate page, their web browser re-hashes the canonical record and verifies the signature locally in WebCrypto using the public key at `/api/public/keys`—no trust in our web server required!

---

## 3. Sample Verification Links

Experience the dynamic Verification Plate and selective-disclosure seal across all three statutory states:

| Status | Public Verification URL (Live) | Instrument Description | Expected Verification State |
| :--- | :--- | :--- | :--- |
| **VALID** | [Live Certificate](https://nishchay-sih.onrender.com/v/sample-cert-val1d-0000) (`/v/sample-cert-val1d-0000`) | Cast Iron Hexagonal Weights 5kg (W-1) | 4 Green Ticks, "Verified in your browser" |
| **EXPIRED** | [Live Certificate](https://nishchay-sih.onrender.com/v/sample-cert-exp1red-00) (`/v/sample-cert-exp1red-00`) | Counter Machine 20kg (CM-1) | Amber Warning Banner, Expired Status |
| **REVOKED** | [Live Certificate](https://nishchay-sih.onrender.com/v/sample-cert-rev0ked-00) (`/v/sample-cert-rev0ked-00`) | NAWI Class III 100kg (Industrial) | Red Revocation Banner with Statutory Reason |

---

## 4. Visual Screenshot Gallery

Every sidebar route and field view is continuously tested at both **1440×900 (Desktop)** and **390×844 (Mobile)** viewports:

| Desktop (1440×900) | Mobile (390×844) | View / Screen |
| :--- | :--- | :--- |
| [View](docs/screens/home-desktop.png) | [View](docs/screens/home-mobile.png) | **Landing & Public Verify Search** |
| [View](docs/screens/public-verify-valid-desktop.png) | [View](docs/screens/public-verify-valid-mobile.png) | **Public Verification Plate & WebCrypto Seal** |
| [View](docs/screens/business-dashboard-desktop.png) | [View](docs/screens/business-dashboard-mobile.png) | **Merchant Dashboard & Next-Step Stepper** |
| [View](docs/screens/lmo-dashboard-desktop.png) | [View](docs/screens/lmo-dashboard-mobile.png) | **Officer Dashboard (Schedule & Workload)** |
| [View](docs/screens/admin-dashboard-desktop.png) | [View](docs/screens/admin-dashboard-mobile.png) | **Admin Dashboard (Reconciliation & Feeds)** |
| [View](docs/screens/lmo-field-job-detail-desktop.png) | [View](docs/screens/lmo-field-job-detail-mobile.png) | **Geo-Tagged Field Premises View (GPS)** |
| [View](docs/screens/lmo-field-job-inspection-desktop.png) | [View](docs/screens/lmo-field-job-inspection-mobile.png) | **Field Camera Capture & Load Tolerance Test** |

---

## 5. Honest Disclosure: Built vs. Simulated vs. Not Built

In accordance with strict hackathon ethics and the SIH26036 project charter, we clearly document what is fully operational versus what is simulated for demonstration:

| Feature / Capability | Classification | Technical Implementation & Notes |
| :--- | :--- | :--- |
| **Merchant Registration & Auth** | **BUILT & RUN** | bcrypt password hashing, JWT in httpOnly SameSite=Lax cookie, CSRF token header check. |
| **Instrument Profiling** | **BUILT & RUN** | Class classification (W-1, L-1, CM-1, NAWI-3), serial tracking, SQLite counter sequences. |
| **Verification State Machine** | **BUILT & RUN** | Strict statutory transitions: DRAFT $\rightarrow$ SUBMITTED $\rightarrow$ PAID $\rightarrow$ SCHEDULED $\rightarrow$ ACCEPTED $\rightarrow$ INSPECTED $\rightarrow$ CERTIFIED. |
| **Fee-Gate Enforcement** | **BUILT & RUN** | Database constraint (`certificates.receipt_id NOT NULL UNIQUE`), HMAC receipt verification, atomic 409 rejection on bypass. |
| **Geo-Tagged Field Verification** | **BUILT & RUN** | Responsive mobile web app (390×844), Haversine radius validation ($\le 300\text{m}$), rear camera capture, photo SHA-256 hashing. |
| **Dual Cryptographic Seal** | **BUILT & RUN** | Node crypto P-256 ECDSA server signing, browser-side WebCrypto IEEE P1363 verification, canonical JSON. |
| **Certificate PDF & Dynamic QR** | **BUILT & RUN** | `pdf-lib` vector A4 generation, status badge, cryptographic panel, dynamic QR code pointing to live HTTPS host. |
| **Right to Check (Citizen Reporting)**| **BUILT & RUN** | Public complaint logging for expired or tampered scales, immediate routing to Admin triage queue. |
| **Role Dashboards & Switcher** | **BUILT & RUN** | Dedicated dashboards for Business, LMO, GATC, and Admin with live 1-click persona switching. |
| **Fee Payment Gateway** | **SIMULATED** | Sandbox payment checkout simulating official treasury receipts without connecting to commercial banks. |
| **Mobile GPS Location Bypass** | **SIMULATED** | "Use demo site location" bypass button provided so reviewers can test field arrival from home without traveling to Hyderabad. |
| **Demo Camera Capture** | **SIMULATED** | "Use demo capture" fallback provided if reviewer denies browser camera permissions or evaluates on desktop. |
| **Fees and Tolerances** | **SIMULATED** | Demonstrator fee values (₹100–₹500) and legal tolerance thresholds based on general rules. |
| **Real Bank Payment Gateways** | **NOT BUILT** | Integration with live UPI/BBPS/Treasury net-banking is out of hackathon prototype scope. |
| **Biometric Aadhaar Authentication**| **NOT BUILT** | Requires UIDAI certified hardware dongles and government license. |
| **Physical IoT Scale Telemetry** | **NOT BUILT** | RS-232 / Bluetooth serial scale integration omitted per Section 6.2. |
| **SMS / Email Push Gateways** | **NOT BUILT** | In-app toasts used instead. No external SMS/email gateway, and no notification log table in the database. |
| **AI Risk Scoring & OCR** | **NOT BUILT** | Excluded to maintain determinism and statutory transparency. |

### Fundamental Honesty Principles
1. **Tamper-Evident, NOT Tamper-Proof:** The ECDSA cryptographic seal proves whether an inspection or certificate record has been modified after issuance; it does **not** physically prevent database modifications, nor does it guarantee the truthfulness of the officer's initial human observations.
2. **The Fee-Gate prevents unauthorized issuance:** The fee-gate ensures that no certificate can be issued by any officer without a verified official fee payment recorded in the system. It does **not** stop off-book cash bribes.
3. **Synthetic Domains Only:** All demo accounts use `@nishchay.example`. No official `.gov.in` domain or government branding is used.
4. **Port Configuration:** The platform runs on unified port `4000` (serving both Vite web assets and `/api` routes). Port 3000 is never used.

---

## 6. Architecture & Security Baseline

```
                        [ Citizen / Inspector / Merchant ]
                                        │
                         HTTPS / WebCrypto (ECDSA P-256)
                                        │
                 ┌──────────────────────▼──────────────────────┐
                 │                Express 4 API                │
                 │   Helmet Strict CSP • httpOnly JWT Cookie   │
                 │   CSRF Token Enforcement • Rate Limiting    │
                 └──────────────┬──────────────────────────────┘
                                │
       ┌────────────────────────┼────────────────────────┐
       ▼                        ▼                        ▼
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Route Table │         │  State Loop  │         │  Crypto Seal │
│ RBAC Guard   │         │ 7-Step Rules │         │ P-256 ECDSA  │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       └────────────────────────┼────────────────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │    SQLite (better-sqlite3)   │
                 │   ACID Atomic Transactions  │
                 │   Append-Only Audit Logging  │
                 │   Receipt ID NOT NULL UNIQUE │
                 └─────────────────────────────┘
```

- **Runtime:** Node.js 22 LTS
- **Backend:** Express 4, TypeScript, `better-sqlite3`, `zod`, `pino`, `helmet`, `express-rate-limit`, `pdf-lib`, `qrcode`.
- **Frontend:** Vite, React 18, Tailwind CSS 3.4, React Router 6, TanStack Query 5, `qr-scanner`, Lucide icons.
- **Typography:** Self-hosted fonts (Bricolage Grotesque, Source Sans 3, JetBrains Mono) via `@fontsource`. Zero runtime CDN dependencies.
- **Port:** Single unified port 4000 serves both Vite production assets (`dist/`) and `/api` routes.

---

## 7. Local Installation & Verification

### Prerequisites
- Node.js $\ge 22.0.0$
- npm $\ge 10.0.0$

### Setup & Run
```bash
# 1. Install dependencies
npm install

# 2. Reset database and seed realistic demo records
npm run demo:reset

# 3. Build production web bundle
npm run build

# 4a. Run in Local Demo Mode (default demo credentials, automatic seeding)
npm run start:demo

# 4b. Or Run Development Server (live reload on port 5173 proxying to 4000)
npm run dev

# 4c. Or Run in Strict Production Mode (requires JWT_SECRET and HMAC_SECRET in .env; DEMO_MODE=false)
npm start
```
The application will be live at `http://localhost:4000` (or `http://localhost:5173` in development mode).

### Production & Render Deployment Configuration
The application is pre-configured for deployment (e.g. on Render via `render.yaml`). Required environment variables:
- `DEMO_MODE`: Set to `'true'` for prototype evaluation (enables 1-click role switcher and sandbox reset) or `'false'` for production.
- `JWT_SECRET`: High-entropy 32+ character secret for signing user session cookies. (Required when `DEMO_MODE=false`).
- `HMAC_SECRET`: High-entropy secret for signing and verifying statutory payment receipts. (Required when `DEMO_MODE=false`).
- `STORAGE_DIR`: Persistent storage directory for inspection photos and uploads (e.g., `storage/uploads`).
- `PUBLIC_BASE_URL`: Public HTTPS URL (e.g., `https://nishchay-sih.onrender.com`) for QR code generation and public verification redirects.


### Complete Verification Suite
Run the exact commands used in continuous integration:

```bash
# Full verification pipeline (encoding, ESLint, TypeScript, Vitest, Vite build)
npm run verify

# End-to-end statutory trust loop smoke test
npm run smoke

# Visual screenshot sweep & strict accessibility/font audit (1440px & 390px)
npm run shots
```

---

## 8. Demo Accounts

| Role | Email | Password | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Merchant** | `biz1@nishchay.example` | `demo123` | Retail weighing scale applications & certificates |
| **Officer (LMO)** | `lmo1@nishchay.example` | `demo123` | Field verification, tolerance readings & photo capture |
| **Test Centre** | `gatc1@nishchay.example` | `demo123` | Industrial class scale testing (NAWI Class III) |
| **Administrator** | `admin@nishchay.example` | `demo123` | System oversight, fee reconciliation & audit log |

*(Tip: You can also use the 1-click **Role Switcher** in the top navigation bar at any time!)*
