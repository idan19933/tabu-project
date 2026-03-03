import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectToDatabase, disconnectFromDatabase } from './config/prisma';

const PORT = parseInt(env.PORT, 10);

async function main() {
  try {
    await connectToDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  await disconnectFromDatabase();
  process.exit(0);
});
