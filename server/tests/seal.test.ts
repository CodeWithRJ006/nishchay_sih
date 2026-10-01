import { describe, it, expect, beforeAll } from 'vitest';
import { ensureKeys, signHash, computeServerHashHex } from '../seal/index.js';
import { verifySeal } from '../../shared/src/seal-browser.js';
import crypto from 'node:crypto';

describe('Seal Verification', () => {
  let privateKey: crypto.KeyObject;
  let publicKeySpkiHex: string;

  beforeAll(() => {
    const keys = ensureKeys();
    privateKey = keys.privateKey;
    publicKeySpkiHex = keys.publicKeySpkiHex;
  });

  it('changes hash when public record changes', () => {
    const record1 = { certNo: '123', val: 'A' };
    const record2 = { certNo: '123', val: 'B' };
    const hash1 = computeServerHashHex(record1);
    const hash2 = computeServerHashHex(record2);
    expect(hash1).not.toBe(hash2);
  });

  it('verifies a valid signature produced by Node using WebCrypto', async () => {
    const record = { certNo: 'NSH-C-2026-000001', status: 'VALID' };
    const hashHex = computeServerHashHex(record);
    const signatureHex = signHash(hashHex, privateKey);
    
    const isValid = await verifySeal(record, signatureHex, publicKeySpkiHex);
    expect(isValid).toBe(true);
  });

  it('fails verifySeal for an altered record', async () => {
    const record = { certNo: 'NSH-C-2026-000001' };
    const hashHex = computeServerHashHex(record);
    const signatureHex = signHash(hashHex, privateKey);
    
    const alteredRecord = { certNo: 'NSH-C-2026-000002' };
    const isValid = await verifySeal(alteredRecord, signatureHex, publicKeySpkiHex);
    expect(isValid).toBe(false);
  });

  it('fails verifySeal for an altered signature', async () => {
    const record = { certNo: 'NSH-C-2026-000001' };
    const hashHex = computeServerHashHex(record);
    const signatureHex = signHash(hashHex, privateKey);
    
    const alteredSig = signatureHex.replace(/[0-9a-f]/g, c => c === '0' ? '1' : '0');
    const isValid = await verifySeal(record, alteredSig, publicKeySpkiHex);
    expect(isValid).toBe(false);
  });

  it('fails verifySeal for a wrong key', async () => {
    const record = { certNo: 'NSH-C-2026-000001' };
    const hashHex = computeServerHashHex(record);
    const signatureHex = signHash(hashHex, privateKey);
    
    const { publicKey: wrongKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const wrongSpkiHex = wrongKey.export({ type: 'spki', format: 'der' }).toString('hex');

    const isValid = await verifySeal(record, signatureHex, wrongSpkiHex);
    expect(isValid).toBe(false);
  });
});
