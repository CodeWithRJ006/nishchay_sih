import crypto from 'node:crypto';

export function signHash(hashHex: string, privateKey: crypto.KeyObject): string {
  const sign = crypto.createSign('SHA256');
  sign.update(`nishchay-seal-v1:${hashHex}`);
  sign.end();
  const signature = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  return signature.toString('hex');
}
