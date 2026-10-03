import crypto from 'node:crypto';

const { privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1'
});

const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const base64 = Buffer.from(pem as string).toString('base64');
process.stdout.write(base64 + '\n');
