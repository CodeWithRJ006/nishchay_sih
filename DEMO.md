# Demonstration Guide

Follow this click path to demonstrate the entire lifecycle of an instrument certification in Nishchay.

## 1. Business Owner: Apply & Pay

1. Navigate to `/login`.
2. Login as **Business**:
   - Email: `biz1@example.com`
   - Password: `demo123`
3. Go to **Instruments** in the sidebar.
4. Click **Add Instrument** (e.g. Weighing Scale, Class III, Temp Serial).
5. Go to **Applications**. Click **New Application**, select the instrument, and submit.
6. The state becomes `SUBMITTED`.
7. Click **Pay Fee** to simulate the dummy payment gateway.
8. State becomes `PAID`. (System auto-routes to LMO based on the business zone).

## 2. Inspector (LMO): Field Verification

1. Logout (click profile avatar > Logout).
2. Login as **LMO**:
   - Email: `lmo1@nishchay.gov.in`
   - Password: `demo123`
3. Click on the mobile **Field Icon** (bottom nav) or navigate to `/field`.
4. Click on the assigned job.
5. Click **Start Inspection**.
6. The app automatically fetches the LMO's GPS coordinates and compares them with the Business Address.
7. Fill out the inspection checklist, enter readings (Applied vs. Observed), upload evidence photos, and select **Pass**.
8. Submit. The system digitally signs and issues the certificate.

## 3. Public Verification

1. Logout.
2. From the Homepage, click **Search Certificates**.
3. Enter the public ID (or scan the QR code via mobile).
4. The screen displays the valid green digital certificate.
5. You can click **Report Issue** to file a consumer complaint against this business.
