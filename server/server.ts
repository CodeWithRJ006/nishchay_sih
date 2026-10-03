import { createApp, logger } from './app.js';
import { runMigrations } from './db/migrate.js';
import { seedDemoData } from './scripts/seed.js';
import { ensureKeys } from './seal/index.js';

if (parseInt(process.versions.node.split('.')[0], 10) < 22) {
    process.exit(1);
}

runMigrations();

ensureKeys();

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
