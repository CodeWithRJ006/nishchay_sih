import { canonicalJson } from './canonicalJson';

export async function computeHashHex(record: unknown): Promise<string> {
  const json = canonicalJson(record);
  const data = new TextEncoder().encode(json);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  return arrayBufferToHex(hashBuffer);
}

export async function verifySeal(publicRecord: unknown, signatureHex: string, publicKeySpkiHex: string): Promise<boolean> {
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
    
    return isValid;
  } catch {
    return false;
  }
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
