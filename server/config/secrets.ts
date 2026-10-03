export function hmacSecret(): string {
  const value = process.env.HMAC_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('HMAC_SECRET is not set');
  return 'dev-hmac-secret';
}
export function jwtSecret(): string {
  const value = process.env.JWT_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is not set');
  return 'dev-secret';
}
