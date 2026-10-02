# Deployment Guide (Render)

Nishchay is designed to be easily deployed on standard PAAS providers like Render using standard Node environments without requiring a Dockerfile.

## Why Not Vercel?
Vercel's serverless environment is ephemeral and read-only. Nishchay requires a persistent writable server because it uses better-sqlite3 for the database and stores local uploads in the `storage/` directory.

## Render Setup (Dockerfile-free)

We provide a `render.yaml` blueprint for one-click deployment.

### Environment Variables

Configure the following environment variables in the Render dashboard or via blueprint:

- `DEMO_MODE`: `true`
- `PUBLIC_BASE_URL`: `https://your-render-url.onrender.com`
- `HMAC_SECRET`: `<secure-random-string>`
- `JWT_SECRET`: `<secure-random-string>`

*Note: Do NOT set `NODE_ENV=production` as a Render variable. If set globally, `npm ci` will skip `devDependencies` (so `vite` and `tsx` would be missing during the build). The `npm start` command already sets `NODE_ENV=production` correctly at runtime.*

### Important Note on Free Tier

If deploying on Render's **Free Tier**, the instance will go to sleep after a period of inactivity. When it wakes up, the ephemeral file system is wiped. Because Nishchay uses SQLite and local file storage, **the database, seal keys, and images will reset to the seeded defaults on every boot**. 
The application handles this gracefully by detecting the wipe and automatically re-seeding the database and seal keys when `DEMO_MODE=true`.

This is acceptable for the SIH prototype demonstration.

## Production Path (Future)

For a persistent, scale-out production deployment:
1. **Database:** Migrate from SQLite to PostgreSQL.
2. **Storage:** Migrate `storage/` to S3 or a similar object storage provider.
3. **Keys:** Move `.keys/private.pem` to a Cloud HSM or KMS provider.
