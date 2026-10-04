let cachedJwtSecret: string | null = null;
let cachedHmacSecret: string | null = null;

export function hmacSecret(): string {
  if (cachedHmacSecret) return cachedHmacSecret;
  const value = process.env.HMAC_SECRET;
  if (value) {
    cachedHmacSecret = value;
    return value;
  }
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
    throw new Error('HMAC_SECRET is not set');
  }
  cachedHmacSecret = 'dev-hmac-secret';
  return cachedHmacSecret;
}

export function jwtSecret(): string {
  if (cachedJwtSecret) return cachedJwtSecret;
  const value = process.env.JWT_SECRET;
  if (value) {
    cachedJwtSecret = value;
    return value;
  }
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
    throw new Error('JWT_SECRET is not set');
  }
  cachedJwtSecret = 'dev-secret';
  return cachedJwtSecret;
}
