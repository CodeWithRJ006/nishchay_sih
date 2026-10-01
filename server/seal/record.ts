import crypto from 'node:crypto';
import { canonicalJson } from '../../shared/src/canonicalJson.js';

export function buildDetailsDigest(details: unknown): string {
  const json = canonicalJson(details);
  return crypto.createHash('sha256').update(json).digest('hex');
}

export function computeServerHashHex(publicRecord: unknown): string {
  const json = canonicalJson(publicRecord);
  return crypto.createHash('sha256').update(json).digest('hex');
}
