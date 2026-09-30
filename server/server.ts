import { createApp, logger } from './app.js';

if (parseInt(process.versions.node.split('.')[0], 10) < 22) {
  console.error('Error: Node.js version must be 22 or higher.');
  process.exit(1);
}

const PORT = process.env.PORT || 4000;
const app = createApp();

app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});
