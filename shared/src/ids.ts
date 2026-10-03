export const generateId = {
  instrument: (seq: number) => `NSH-I-${seq.toString().padStart(6, '0')}`,
  application: (year: number, seq: number) => `NSH-A-${year}-${seq.toString().padStart(6, '0')}`,
  receipt: (year: number, seq: number) => `NSH-R-${year}-${seq.toString().padStart(6, '0')}`,
  certificate: (year: number, seq: number) => `NSH-C-${year}-${seq.toString().padStart(6, '0')}`
};

export const DEMO_CERT_VALID = 'sample-cert-val1d-0000';
export const DEMO_CERT_EXPIRED = 'sample-cert-exp1red-00';
export const DEMO_CERT_REVOKED = 'sample-cert-rev0ked-00';

/**
 * Accepts a bare certificate ID or a same-origin /v/{id} URL and rejects everything else.
 * Returns the extracted certificate ID or null if invalid.
 */
export function parseVerifyInput(input: string, baseUrl?: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Relative /v/{id} path
  if (trimmed.startsWith('/v/')) {
    const match = trimmed.match(/^\/v\/([A-Za-z0-9_-]+)$/);
    return match ? match[1] : null;
  }

  // 2. Full URL (must match origin if baseUrl is provided, and have path /v/{id})
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      if (baseUrl) {
        const base = new URL(baseUrl);
        if (url.origin.toLowerCase() !== base.origin.toLowerCase()) {
          return null;
        }
      }
      const match = url.pathname.match(/^\/v\/([A-Za-z0-9_-]+)$/);
      if (match && !url.search && !url.hash) {
        return match[1];
      }
      return null;
    } catch {
      return null;
    }
  }

  // 3. Bare ID: valid format must contain only alphanumerics, hyphens, and underscores
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

