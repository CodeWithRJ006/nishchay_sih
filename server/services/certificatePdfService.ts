// Certificate PDF generation service (Block 7)
// Uses pdf-lib to create an authoritative, well-designed A4 PDF with certificate data, QR code, and signature.
// Strictly typed, no `any`, UTF‑8 output via Node APIs only.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import { db } from '../db/index.js';

/**
 * Creates a PDF for a certificate identified by its publicId.
 * Supports an optional baseUrl so QR codes resolve to the active live server or local network IP.
 * Returns a Uint8Array containing the PDF bytes.
 */
export async function createPdf(publicId: string, baseUrl?: string): Promise<Uint8Array> {
  // Fetch certificate record – must include public_record JSON.
  const cert = db
    .prepare('SELECT public_record, hash, signature, key_id, status FROM certificates WHERE public_id = ?')
    .get(publicId) as { public_record: string; hash: string; signature: string; key_id: string; status: string } | undefined;

  if (!cert) {
    throw new Error('Certificate not found');
  }

  const record = JSON.parse(cert.public_record) as Record<string, unknown>;

  const certificateNo = String(record.certificateNo || record.certNo || publicId);
  const instrumentId = String(record.instrumentId || record.instrument_id || 'N/A');
  const tradeName = String(record.tradeName || record.business_name || 'N/A');
  const instrumentClass = String(record.instrumentClass || record.instrument_class || 'N/A');
  const serialNo = String(record.serialNo || record.serial || 'N/A');
  const validFrom = String(record.validFrom || record.valid_from || 'N/A');
  const validTo = String(record.validTo || record.valid_to || 'N/A');
  const authorityName = String(record.authorityName || 'Legal Metrology Department, Government of Telangana');
  const hash = cert.hash;
  const signature = cert.signature;
  const keyId = cert.key_id;
  const status = (cert.status || 'VALID').toUpperCase();

  // Create a new PDF document.
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points (210 x 297 mm)

  // Load standard fonts.
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  // Outer framing card
  page.drawRectangle({
    x: 36,
    y: 36,
    width: 523.28,
    height: 769.89,
    borderColor: rgb(0.82, 0.86, 0.90),
    borderWidth: 1.5,
    color: rgb(1, 1, 1),
  });

  // Top header accent line
  page.drawRectangle({
    x: 36,
    y: 805.89 - 6,
    width: 523.28,
    height: 6,
    color: rgb(0.06, 0.30, 0.51), // Calibration Blue
  });

  // Department and Title Header
  page.drawText('LEGAL METROLOGY VERIFICATION CERTIFICATE', {
    x: 54,
    y: 770,
    size: 15,
    font: fontBold,
    color: rgb(0.06, 0.30, 0.51),
  });

  page.drawText('DEPARTMENT OF CONSUMER AFFAIRS • LEGAL METROLOGY DIVISION', {
    x: 54,
    y: 752,
    size: 9,
    font: fontBold,
    color: rgb(0.35, 0.40, 0.46),
  });

  page.drawText('National Digital Verification Prototype • SIH26036', {
    x: 54,
    y: 738,
    size: 8.5,
    font,
    color: rgb(0.50, 0.55, 0.60),
  });

  // Status Badge Stamp
  let statusBg = rgb(0.04, 0.48, 0.35); // Green for VALID
  if (status === 'EXPIRED') statusBg = rgb(0.72, 0.47, 0.12);
  if (status === 'REVOKED') statusBg = rgb(0.70, 0.15, 0.12);

  page.drawRectangle({
    x: 54,
    y: 704,
    width: 100,
    height: 22,
    color: statusBg,
  });

  page.drawText(`STATUS: ${status}`, {
    x: 62,
    y: 710,
    size: 9.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // Generate QR code linking to public verification page
  const publicBase = baseUrl || process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:4000';
  const qrData = `${publicBase}/v/${publicId}`;
  const qrPng = await QRCode.toDataURL(qrData, { margin: 1, width: 200 });
  const qrImageBytes = Buffer.from(qrPng.split(',')[1], 'base64');
  const qrImage = await pdfDoc.embedPng(qrImageBytes);

  // QR box in upper right
  const qrBoxX = 415;
  const qrBoxY = 665;
  page.drawRectangle({
    x: qrBoxX - 6,
    y: qrBoxY - 26,
    width: 122,
    height: 142,
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1),
  });

  page.drawImage(qrImage, {
    x: qrBoxX,
    y: qrBoxY,
    width: 110,
    height: 110,
  });

  page.drawText('SCAN TO VERIFY LIVE', {
    x: qrBoxX + 4,
    y: qrBoxY - 12,
    size: 7.5,
    font: fontBold,
    color: rgb(0.06, 0.30, 0.51),
  });
  page.drawText('WebCrypto Trust Loop', {
    x: qrBoxX + 6,
    y: qrBoxY - 22,
    size: 6.5,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });

  // Horizontal divider
  page.drawLine({
    start: { x: 54, y: 692 },
    end: { x: 395, y: 692 },
    thickness: 1,
    color: rgb(0.88, 0.90, 0.93),
  });

  // Table of instrument & business details
  let rowY = 668;
  const labelX = 54;
  const valX = 180;
  const rowHeight = 22;

  const rows: { label: string; val: string; mono?: boolean }[] = [
    { label: 'Certificate Number', val: certificateNo },
    { label: 'Public Verification ID', val: publicId, mono: true },
    { label: 'Registered Business', val: tradeName },
    { label: 'Instrument ID', val: instrumentId, mono: true },
    { label: 'Instrument Class', val: instrumentClass },
    { label: 'Serial Number', val: serialNo, mono: true },
    { label: 'Effective Date', val: validFrom },
    { label: 'Expiry Date', val: validTo },
    { label: 'Issuing Authority', val: authorityName },
  ];

  rows.forEach((r, idx) => {
    // Alternating subtle row fill
    if (idx % 2 === 0) {
      page.drawRectangle({
        x: 52,
        y: rowY - 6,
        width: 345,
        height: rowHeight,
        color: rgb(0.97, 0.98, 0.99),
      });
    }

    page.drawText(r.label, {
      x: labelX,
      y: rowY,
      size: 9,
      font: fontBold,
      color: rgb(0.2, 0.25, 0.3),
    });

    page.drawText(r.val, {
      x: valX,
      y: rowY,
      size: 9,
      font: r.mono ? fontMono : font,
      color: rgb(0.05, 0.1, 0.15),
    });

    rowY -= rowHeight;
  });

  // Cryptographic Seal Card
  const sealCardY = rowY - 14;
  page.drawRectangle({
    x: 54,
    y: sealCardY - 140,
    width: 487.28,
    height: 145,
    borderColor: rgb(0.80, 0.85, 0.90),
    borderWidth: 1,
    color: rgb(0.96, 0.97, 0.99),
  });

  page.drawText('DIGITAL INTEGRITY & CRYPTOGRAPHIC SEAL', {
    x: 68,
    y: sealCardY - 18,
    size: 10,
    font: fontBold,
    color: rgb(0.06, 0.30, 0.51),
  });

  page.drawText('Algorithm: ECDSA P-256 (FIPS 186-4) • IEEE P1363 Format • SHA-256 Digest', {
    x: 68,
    y: sealCardY - 34,
    size: 8,
    font,
    color: rgb(0.35, 0.4, 0.45),
  });

  page.drawText(`Public Key ID:  ${keyId}`, {
    x: 68,
    y: sealCardY - 54,
    size: 8,
    font: fontMono,
    color: rgb(0.1, 0.15, 0.2),
  });

  page.drawText(`Record Digest:  ${hash}`, {
    x: 68,
    y: sealCardY - 72,
    size: 7.5,
    font: fontMono,
    color: rgb(0.1, 0.15, 0.2),
  });

  const sigLine1 = signature.length > 64 ? signature.substring(0, 64) : signature;
  const sigLine2 = signature.length > 64 ? signature.substring(64, 128) : '';

  page.drawText(`Seal Signature: ${sigLine1}`, {
    x: 68,
    y: sealCardY - 90,
    size: 7,
    font: fontMono,
    color: rgb(0.2, 0.25, 0.3),
  });

  if (sigLine2) {
    page.drawText(`                ${sigLine2}`, {
      x: 68,
      y: sealCardY - 102,
      size: 7,
      font: fontMono,
      color: rgb(0.2, 0.25, 0.3),
    });
  }

  page.drawText('Verification Notice: Tamper-evident seal verified in-browser using WebCrypto. Hash or signature mismatch invalidates seal.', {
    x: 68,
    y: sealCardY - 126,
    size: 7.5,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });

  // Footer note
  page.drawLine({
    start: { x: 54, y: 70 },
    end: { x: 541.28, y: 70 },
    thickness: 0.5,
    color: rgb(0.85, 0.88, 0.92),
  });

  page.drawText('Prototype built for SIH26036. Not an official government system. All data synthetic.', {
    x: 54,
    y: 52,
    size: 8,
    font,
    color: rgb(0.45, 0.50, 0.55),
  });

  page.drawText('Statutory compliance demonstrated under the Legal Metrology (General) Rules.', {
    x: 54,
    y: 42,
    size: 7.5,
    font,
    color: rgb(0.55, 0.60, 0.65),
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Exported service object to match import style used elsewhere.
 */
export const certificatePdfService = { createPdf };

