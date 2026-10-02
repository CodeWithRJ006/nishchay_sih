# Demo Script

This script walks through the golden path of Nishchay over HTTP locally.

### Setup
Ensure the server is running on port 4000:
```bash
npm run demo:reset
npm start
```

### Golden Path Flow
1. **Apply:** Login as `biz1@nishchay.example`, register an instrument, and submit an application.
2. **Pay:** Complete the Sandbox payment callback to move the application forward.
3. **Schedule:** Login as `gatc1@nishchay.example` (or an admin) to schedule the application for inspection.
4. **Officer Accept:** Login as `lmo1@nishchay.example`, go to Jobs, and view the assigned inspection.
5. **Arrive:** Click Arrive at the location.
6. **Inspect:** Fill out the checklist, take two photos (simulated via file upload or camera capture), and submit.
7. **Certificate:** The system automatically issues a tamper-evident digital certificate and seals it.
8. **Public Verify:** Navigate to `/v/:publicId` to verify the certificate's authenticity, which dynamically recalculates and verifies the `detailsDigest`, photo SHAs, and digital signature.

### Additional Features
- **Search & Reports:** Login as Admin or Officer, navigate to Certificate Search, filter by dates/status, and Export CSV.
- **Admin Provisioning:** Login as Admin to provision new LMO or GATC users.
