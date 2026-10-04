if (process.env.DEMO_MODE === undefined) {
  process.env.DEMO_MODE = 'false';
}

import { createApp, logger } from './app.js';
import { runMigrations } from './db/migrate.js';
import { seedDemoData } from './scripts/seed.js';
import { ensureKeys } from './seal/index.js';
import { storageDir } from './config/paths.js';

if (parseInt(process.versions.node.split('.')[0], 10) < 22) {
    process.exit(1);
}

if (process.env.DEMO_MODE !== 'true') {
  if (!process.env.JWT_SECRET) {
    logger.error('JWT_SECRET is not set');
    process.exit(1);
  }
  if (!process.env.HMAC_SECRET) {
    logger.error('HMAC_SECRET is not set');
    process.exit(1);
  }
}

runMigrations();

ensureKeys();
storageDir();

if (process.env.DEMO_MODE === 'true') {
  seedDemoData();
}

const PORT = process.env.PORT || 4000;
// Log chosen port for debugging
logger.info(`Using port ${PORT}`);
const app = createApp();

app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});
