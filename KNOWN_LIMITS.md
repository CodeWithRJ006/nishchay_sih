# Known Limits

This document outlines the known technical and functional limitations of the current Nishchay prototype.

## Technical Limits

1. **SQLite Concurrency:** The system relies on `better-sqlite3`. While fast for reads, heavy concurrent write loads will hit disk I/O bottlenecks.
2. **Local Storage Ephemerality:** File uploads (inspection photos) are saved to the local `/uploads` directory. In cloud PAAS environments (like Render/Heroku) without persistent volumes, these files will disappear upon dyno restart.
3. **Session Management:** JWTs are stateless. If an admin revokes an account, the user will remain logged in until their current JWT expires (1 day), unless cross-checked with a blacklist table on every request (which is omitted for performance).
4. **GPS Spoofing:** The browser's Geolocation API is trusted verbatim. Determined users can spoof their coordinates using developer tools. A native mobile app with OS-level checks is required for production.

## Functional Limits

1. **No External SMS/Email:** Notification logs are written to the database, but actual email/SMS transport layers (SendGrid/Twilio) are mocked.
2. **Single Year Validity:** All issued certificates currently default to exactly 1 year of validity. Varying validity lengths by instrument class is not yet configurable via UI.
3. **Payment Gateway Sim:** The payment gateway strictly returns success/failure instantaneously. Asynchronous payment reconciliation via webhooks is implemented logically, but practically bypassed by the frontend simulating a synchronous flow.
