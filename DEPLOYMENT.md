# Deployment Guide (Render)

Nishchay is designed to be easily deployed on standard PAAS providers like Render using standard Node environments without requiring a Dockerfile.

## Render Setup (Dockerfile-free)

1. Create a **New Web Service** on Render connected to your GitHub repository.
2. **Runtime:** `Node`
3. **Build Command:** `npm ci && npm run build`
4. **Start Command:** `npm start`

### Environment Variables

Configure the following environment variables in the Render dashboard:

- `NODE_ENV`: `production`
- `DEMO_MODE`: `true`
- `PORT`: `10000` (Render default)
- `PUBLIC_BASE_URL`: `https://your-render-url.onrender.com`
- `HMAC_SECRET`: `<secure-random-string>`
- `JWT_SECRET`: `<secure-random-string>`

### Important Note on Free Tier

If deploying on Render's **Free Tier**, the instance will go to sleep after a period of inactivity. When it wakes up, the ephemeral file system is wiped. Because Nishchay uses SQLite and local file storage (`/uploads`), **the database and images will reset to the seeded defaults on every boot**. 

This is acceptable for the SIH prototype demonstration.

## Production Path (Future)

For a persistent, scale-out production deployment:
1. **Database:** Migrate from SQLite to PostgreSQL.
2. **Storage:** Migrate `/uploads` to S3 or a similar object storage provider.
3. **Keys:** Move `.keys/private.pem` to a Cloud HSM or KMS provider.
