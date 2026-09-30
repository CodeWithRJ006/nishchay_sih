import { createApp, logger } from './app.js';

const PORT = process.env.PORT || 4000;
const app = createApp();

app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});
