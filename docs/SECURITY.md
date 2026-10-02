# Security & Threat Model

Nishchay implements a modern security posture aimed at preventing specific metrology fraud vectors.

## Threat Model

| Threat Actor | Vector | Mitigation Strategy |
| :--- | :--- | :--- |
| **Corrupt Inspector (LMO)** | Fake inspections from home | **GPS-Enforcement (Block 6a):** Coordinates are captured from the mobile device and distance from the business location is verified. |
| **Business Owner** | Modifying issued certificates | **Digital Seal (Block 7):** Certificates are ECDSA signed. Any tamper invalidates the QR code. |
| **Malicious Admin** | Deleting audit logs | **Immutable Audit Log:** SQLite triggers prevent `UPDATE` or `DELETE` on the `audit_log` table. |
| **General Attacker** | Forging fee payments | **HMAC Validation (Block 5):** Payment webhooks enforce timing checks (15m window) and idempotency keys to prevent replay attacks. |

## Controls Implemented

1. **Role-Based Access Control (RBAC):** Strict `routeTable.ts` enforcement ensures only authorized roles access specific APIs. Default `DenyAll` strategy.
2. **CSRF Protection:** Cookie-based JWT with Double Submit Cookie (CSRF header matching).
3. **Password Security:** Argon2 hashes for all stored passwords.
4. **Helmet & Security Headers:** HSTS, CSP, No-Sniff enforced via Express middleware.
5. **Rate Limiting:** `express-rate-limit` prevents brute force and enumeration.

## What is NOT Covered (Out of Scope for SIH Prototype)

1. **Hardware Security Modules:** The ECDSA private key is stored locally (`.keys/private.pem`) instead of AWS KMS or CloudHSM.
2. **Physical Device OCR Verification:** We do not currently OCR the photo to verify the serial number matches the application.
3. **Advanced Biometrics:** LMOs are not required to provide fingerprint/facial recognition at the time of inspection (relying on device auth).

## NPM Audit Exemptions
- **react-router-dom / react-router (Moderate):** Current version `6.22.3` flags a moderate Open Redirect / SSR vulnerability. Fixing this requires upgrading to `7.18.x`, which constitutes a major breaking change in router APIs. Since this application does not use SSR (Single Page App only) and explicitly whitelists valid routes, this risk is mitigated.
