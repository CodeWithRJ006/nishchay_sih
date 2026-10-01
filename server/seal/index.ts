import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson } from '../../shared/src/canonicalJson.js';

const KEYS_DIR = path.join(process.cwd(), '.keys');
const PRIV_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUB_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

export function ensureKeys(): { privateKey: crypto.KeyObject; publicKey: crypto.KeyObject; keyId: string; publicKeySpkiHex: string } {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  let privateKey: crypto.KeyObject;
  let publicKey: crypto.KeyObject;

  if (!fs.existsSync(PRIV_KEY_PATH) || !fs.existsSync(PUB_KEY_PATH)) {
    const { privateKey: priv, publicKey: pub } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1'
    });
    privateKey = priv;
    publicKey = pub;

    fs.writeFileSync(PRIV_KEY_PATH, privateKey.export({ type: 'pkcs8', format: 'pem' }));
    fs.writeFileSync(PUB_KEY_PATH, publicKey.export({ type: 'spki', format: 'pem' }));
  } else {
    privateKey = crypto.createPrivateKey(fs.readFileSync(PRIV_KEY_PATH));
    publicKey = crypto.createPublicKey(fs.readFileSync(PUB_KEY_PATH));
  }

  const spkiDer = publicKey.export({ type: 'spki', format: 'der' });
  const publicKeySpkiHex = spkiDer.toString('hex');
  const keyId = crypto.createHash('sha256').update(spkiDer).digest('hex').substring(0, 8);

  return { privateKey, publicKey, keyId, publicKeySpkiHex };
}

export function signHash(hashHex: string, privateKey: crypto.KeyObject): string {
  const sign = crypto.createSign('SHA256');
  sign.update(`nishchay-seal-v1:${hashHex}`);
  sign.end();
  const signature = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  return signature.toString('hex');
}

export function buildDetailsDigest(details: unknown): string {
  const json = canonicalJson(details);
  return crypto.createHash('sha256').update(json).digest('hex');
}

export function computeServerHashHex(publicRecord: unknown): string {
  const json = canonicalJson(publicRecord);
  return crypto.createHash('sha256').update(json).digest('hex');
}
