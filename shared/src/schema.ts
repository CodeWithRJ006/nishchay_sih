import { z } from 'zod';

export const BusinessSchema = z.object({
  id: z.string(),
  tradeName: z.string(),
  ownerName: z.string(),
  email: z.string().email(),
  phone: z.string(),
  address: z.string(),
});
export type Business = z.infer<typeof BusinessSchema>;

export const InstrumentSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  instrumentClass: z.string(),
  serialNo: z.string(),
  manufacturer: z.string(),
  model: z.string(),
  status: z.enum(['Active', 'Inactive']),
});
export type Instrument = z.infer<typeof InstrumentSchema>;

export const ApplicationSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  instrumentId: z.string(),
  state: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Application = z.infer<typeof ApplicationSchema>;

export const PaymentSchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  amount: z.number(),
  status: z.enum(['Pending', 'Success', 'Failed']),
  transactionId: z.string().optional(),
});
export type Payment = z.infer<typeof PaymentSchema>;

export const ReceiptSchema = z.object({
  id: z.string(),
  paymentId: z.string(),
  receiptUrl: z.string(),
  issuedAt: z.string(),
  digest: z.string(),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

export const InspectionSchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  officerId: z.string(),
  scheduledDate: z.string(),
  gpsLocation: z.string().optional(),
  checklist: z.record(z.boolean()).optional(),
  readings: z.array(z.object({ applied: z.number(), observed: z.number() })).optional(),
  status: z.string(),
});
export type Inspection = z.infer<typeof InspectionSchema>;

export const CertificateSchema = z.object({
  id: z.string(),
  applicationId: z.string(),
  publicRecordHash: z.string(),
  signature: z.string(),
  validFrom: z.string(),
  validTo: z.string(),
  status: z.string(),
});
export type Certificate = z.infer<typeof CertificateSchema>;

export const ComplaintSchema = z.object({
  id: z.string(),
  certificateId: z.string().optional(),
  details: z.string(),
  status: z.string(),
  createdAt: z.string(),
});
export type Complaint = z.infer<typeof ComplaintSchema>;
