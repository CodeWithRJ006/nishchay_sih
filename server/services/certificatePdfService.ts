// Certificate PDF generation service (Block 7)
// Uses pdf-lib to create an A4 PDF with certificate data, QR code, and signature.
// Strictly typed, no `any`, UTF‑8 output via Node APIs only.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import { db } from '../db/index.js';

/**
 * Creates a PDF for a certificate identified by its publicId.
 * Returns a Uint8Array containing the PDF bytes.
 */
export async function createPdf(publicId: string): Promise<Uint8Array> {
  // Fetch certificate record – must include public_record JSON.
  const cert = db
    .prepare('SELECT public_record, hash, signature, key_id, status FROM certificates WHERE public_id = ?')
    .get(publicId) as { public_record: string; hash: string; signature: string; key_id: string; status: string } | undefined;

  if (!cert) {
    throw new Error('Certificate not found');
  }

  const record = JSON.parse(cert.public_record) as Record<string, unknown>;

  const certificateNo = String(record.certificateNo || record.certNo || '');
  const instrumentId = String(record.instrumentId || record.instrument_id || '');
  const tradeName = String(record.tradeName || record.business_name || '');
  const instrumentClass = String(record.instrumentClass || record.instrument_class || '');
  const serialNo = String(record.serialNo || record.serial || '');
  const validFrom = String(record.validFrom || record.valid_from || '');
  const validTo = String(record.validTo || record.valid_to || '');
  const authorityName = String(record.authorityName || 'Legal Metrology Department');
  const hash = cert.hash;
  const signature = cert.signature;
  const keyId = cert.key_id;

  // Create a new PDF document.
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points.

  // Load standard fonts.
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  // Title header
  page.drawText('LEGAL METROLOGY VERIFICATION CERTIFICATE', {
    x: 72,
    y: page.getHeight() - 60,
    size: 14,
    font: fontBold,
    color: rgb(0.06, 0.3, 0.51), // Calibration Blue
  });

  page.drawText('Government of India - National Digital Verification Prototype', {
    x: 72,
    y: page.getHeight() - 78,
    size: 9,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  let y = page.getHeight() - 110;
  const fontSize = 10;
  const lineHeight = 18;

  const drawRow = (label: string, value: string, isMono = false) => {
    page.drawText(label, {
      x: 72,
      y,
      size: fontSize,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    page.drawText(value, {
      x: 180,
      y,
      size: fontSize,
      font: isMono ? fontMono : font,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;
  };

  drawRow('Certificate No', certificateNo || publicId);
  drawRow('Public ID', publicId, true);
  drawRow('Status', cert.status);
  drawRow('Business Name', tradeName);
  drawRow('Instrument ID', instrumentId, true);
  drawRow('Instrument Class', instrumentClass);
  drawRow('Serial Number', serialNo, true);
  drawRow('Valid From', validFrom);
  drawRow('Valid To', validTo);
  drawRow('Issuing Authority', authorityName);
  drawRow('Key ID', keyId, true);

  y -= 10;
  page.drawText('Cryptographic Seal Details:', {
    x: 72,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 14;
  page.drawText(`SHA-256 Hash: ${hash}`, {
    x: 72,
    y,
    size: 7,
    font: fontMono,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 12;
  page.drawText(`ECDSA P-256 Signature (first 64 chars): ${signature.substring(0, 64)}...`, {
    x: 72,
    y,
    size: 7,
    font: fontMono,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Generate QR code linking to the public verification page.
  const publicBase = process.env.PUBLIC_BASE_URL || 'https://example.com';
  const qrData = `${publicBase}/v/${publicId}`;
  const qrPng = await QRCode.toDataURL(qrData, { margin: 1, width: 140 });
  const qrImageBytes = Buffer.from(qrPng.split(',')[1], 'base64');
  const qrImage = await pdfDoc.embedPng(qrImageBytes);
  const qrDims = qrImage.scale(1);
  page.drawImage(qrImage, {
    x: page.getWidth() - qrDims.width - 72,
    y: page.getHeight() - qrDims.height - 110,
    width: qrDims.width,
    height: qrDims.height,
  });

  // Footer note
  page.drawText('Prototype built for SIH26036. Not an official government system. All data synthetic.', {
    x: 72,
    y: 36,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Exported service object to match import style used elsewhere.
 */
export const certificatePdfService = { createPdf };
