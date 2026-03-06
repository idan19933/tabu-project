/**
 * @file index.ts
 * @description Server entry point — connects to the database and starts the
 * HTTP server. Registers a SIGTERM handler for graceful shutdown.
 */

import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectToDatabase, disconnectFromDatabase } from './config/prisma';

const PORT = parseInt(env.PORT, 10);

/**
 * Bootstraps the application by connecting to PostgreSQL via Prisma and then
 * starting the Express HTTP server on the configured port.
 *
 * @throws Exits the process with code 1 if the database connection fails.
 */
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

// Graceful shutdown — disconnect Prisma before the process exits
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  await disconnectFromDatabase();
  process.exit(0);
});
