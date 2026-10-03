import { canonicalJson } from './canonicalJson.js';

export type SealVerificationState = 'checking' | 'verified' | 'failed' | 'unavailable';

export interface SealVerificationResult {
  state: SealVerificationState;
  reason?: string;
}

export async function computeHashHex(record: unknown): Promise<string> {
  const json = canonicalJson(record);
  const data = new TextEncoder().encode(json);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  return arrayBufferToHex(hashBuffer);
}

export async function verifySealResult(
  publicRecord: unknown,
  signatureHex: string | null | undefined,
  publicKeySpkiHex: string | null | undefined
): Promise<SealVerificationResult> {
  if (!publicRecord || !signatureHex || !publicKeySpkiHex) {
    return { state: 'unavailable', reason: 'Missing verification data (record, signature, or public key).' };
  }

  if (typeof globalThis.crypto?.subtle === 'undefined') {
    return { state: 'unavailable', reason: 'WebCrypto API is not supported in this runtime environment.' };
  }

  try {
    const hashHex = await computeHashHex(publicRecord);
    const dataToVerify = new TextEncoder().encode(`nishchay-seal-v1:${hashHex}`);
    
    const sigBuf = hexToArrayBuffer(signatureHex);
    const pubKeyBuf = hexToArrayBuffer(publicKeySpkiHex);

    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'spki',
      pubKeyBuf,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify']
    );

    const isValid = await globalThis.crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      cryptoKey,
      sigBuf,
      dataToVerify
    );
    
    if (isValid) {
      return { state: 'verified' };
    }
    return { state: 'failed', reason: 'Cryptographic signature mismatch. Record content does not match authority seal.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { state: 'failed', reason: `Cryptographic verification failed: ${msg}` };
  }
}

export async function verifySeal(publicRecord: unknown, signatureHex: string, publicKeySpkiHex: string): Promise<boolean> {
  const result = await verifySealResult(publicRecord, signatureHex, publicKeySpkiHex);
  return result.state === 'verified';
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const cleanHex = hex.trim();
  const bytes = new Uint8Array(Math.ceil(cleanHex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
