# NISHCHAY: 5-Minute Evaluation Guide for Hackathon Judges
**Problem Statement SIH26036 • Legal Metrology Digital Verification Prototype**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-nishchay--sih.onrender.com-brightgreen?style=for-the-badge&logo=render)](https://nishchay-sih.onrender.com)
[![Status](https://img.shields.io/badge/System%20Status-Healthy%20200%20OK-blue?style=for-the-badge)](https://nishchay-sih.onrender.com/api/health)

> 🚀 **Live Demo URL:** [https://nishchay-sih.onrender.com](https://nishchay-sih.onrender.com)  
> 🧪 **Live Sample Certificate:** [https://nishchay-sih.onrender.com/v/sample-cert-val1d-0000](https://nishchay-sih.onrender.com/v/sample-cert-val1d-0000)

This document provides a guided walkthrough for evaluators, jury members, and reviewers. It demonstrates the core trust loop, the tamper-evident cryptographic seal, and the statutory fee-gate in under 5 minutes.

---

## Quick Navigation & Persona Switching

You do not need to log out and log in repeatedly. Use the **Role Switcher** located in the top navigation bar of every page to toggle instantly between personas:

- 🏢 **BUSINESS (Merchant):** Ramesh Rao (`biz1@nishchay.example`)
- 👮 **LMO (Legal Metrology Officer):** Priya Sharma (`lmo1@nishchay.example`)
- 🔬 **GATC (Test Centre Specialist):** K. V. Raman (`gatc1@nishchay.example`)
- 🏛️ **ADMIN (State Director):** Admin User (`admin@nishchay.example`)

*(Password for all accounts if logging in manually: `Password123!`)*

---

## ⏱️ 5-Minute Evaluation Walkthrough

### 1. The Verification Plate & Browser-Side WebCrypto (60 seconds)
1. Navigate to the public verification page for our valid sample instrument:  
   👉 **`/v/sample-cert-val1d-0000`**
2. **Observe the Verification Plate:**
   - **Status Badge:** Clean green `VALID` stamp.
   - **4 Statutory Trust Ticks:**
     1. Fee receipt (paid & HMAC-verified before scheduling).
     2. Officer on site (GPS premises radius confirmed).
     3. Checklist recorded (physical tolerances tested).
     4. Seal intact (cryptographic hash matches inspection data).
3. **Local WebCrypto Verification:**
   - Notice the badge: `Verified in your browser • Key: c307b510`.
   - Open your browser's Developer Tools (`F12` $\rightarrow$ **Console**).
   - You will see the client-side log confirming that the browser downloaded the ECDSA P-256 public key from `/api/public/keys` and executed `window.crypto.subtle.verify()` locally in your browser sandbox without trusting the server's word!

---

### 2. The Cryptographic Tamper Demo with Undo (60 seconds)
1. On any page, click the **Judge's Lab** button in the header (marked with a beaker icon 🧪).
2. Under the **Security Demos** tab, find the **Tamper Demo (ECDSA Seal Verification)** card.
3. Click **"Tamper Record"**.
   - The backend modifies the stored JSON public record in SQLite, simulating database tampering or administrative corruption.
4. Click the link to view the certificate or refresh `/v/sample-cert-val1d-0000`.
   - **Result:** The Verification Plate immediately flips **Red**!
   - The status changes to **Seal broken**.
   - The fourth trust tick breaks, proving that any unauthorized alteration invalidates the cryptographic signature.
5. In the Judge's Lab drawer, click **"Restore Original (Undo)"**.
   - Refresh the page: the legitimate public record is restored and WebCrypto reports the seal valid again.

---

### 3. The Statutory Fee-Gate Refusal (45 seconds)
1. Open the **Judge's Lab** drawer 🧪.
2. In the **Fee-Gate Enforcement** card, click **"Bypass Fee-Gate (Attempt Issuance)"**.
   - The system executes an administrative attempt to issue a verification certificate for an application that lacks a paid e-receipt.
3. **Result:**
   - The request is immediately rejected by the database transaction with `HTTP 409 Conflict`.
   - The response payload returns `code: "GATE_BLOCKED"`.
   - The attempt is recorded in the append-only `audit_log` table, proving that no officer or administrator can bypass statutory fees.

---

### 4. Geo-Tagged Field Verification on Mobile (90 seconds)
1. Using the role switcher in the header, switch to **LMO** (`Priya Sharma`).
2. Press `F12` in Chrome/Edge and toggle **Device Toolbar** to **Mobile Viewport (390×844)** (iPhone 14 / Pixel 7).
3. In the sidebar or bottom navigation, click **Field Verification** (or open `/field`).
4. Select the job for **Secunderabad Grain Wholesale** (`NSH-A-2026-000009`).
5. **Inspect the premises:**
   - Notice the SVG map indicating premises coordinates (`Lat: 17.3850`, `Lng: 78.4867`).
   - If evaluating remotely from home or outside Hyderabad, tap **"Use demo site location"** (with the orange DEMO badge) to arrive at the premises.
6. Tap **"Start Inspection"**:
   - **Step 1 (Evidence):** Tap **"Start Camera"** (falls back to device camera or webcam) or tap **"Use demo capture"** to capture two inspection photographs. Tap *Continue to Checklist*.
   - **Step 2 (Checklist):** Answer statutory physical verification questions (level indicator, stamp integrity, lead seals). Tap *Continue to Readings*.
   - **Step 3 (Readings):** Enter load test points (e.g. Applied `10`, Observed `10`). The app calculates legal error against the maximum permissible error ($\pm 0.5\text{g}$).
   - **Step 4 (Verdict):** Tap **PASS** and submit. The inspection record is cryptographically sealed into the SQLite database.

---

### 5. Certificate PDF & Live Phone QR Code Scan (45 seconds)
1. On any certificate view, click **"Download PDF Certificate"**.
2. **Review the generated document:**
   - Official A4 layout with Calibration Blue framing and status badge stamp.
   - Complete tabular breakdown of instrument metadata and business address.
   - **Cryptographic Seal Panel:** Details the SHA-256 Digest, IEEE P1363 ECDSA signature, and SPKI Key ID.
   - **Scan the QR Code with your real mobile phone:**
     - Point your phone camera at the QR code on your computer screen.
     - The QR code dynamically encodes the active live URL (`${PUBLIC_BASE_URL}/v/${publicId}`).
     - Your phone opens the live verification page directly with full browser-side WebCrypto validation!

---

### 6. "Right to Check" Citizen Reporting (30 seconds)
1. On `/v/sample-cert-val1d-0000`, click the red **"Right to Check"** button.
2. Select a category (e.g. *Report suspected tampering*) and enter an observation (e.g. *"Lead seal severed on merchant scale"*).
3. Submit the report.
4. Using the top role switcher, switch to **ADMIN**.
5. Click **Complaints** in the sidebar:
   - Notice the consumer complaint logged in real time with timestamp, status, and full certificate link.

---

## 🔁 Restoring Factory State

To reset the database back to clean, pristine demo data at any time:
- Open the **Judge's Lab** drawer 🧪 $\rightarrow$ Click the **System & Reset** tab $\rightarrow$ Click **"Factory Demo Reset"**.
- Alternatively, run `npm run demo:reset` in your terminal.
