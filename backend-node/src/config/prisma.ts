/**
 * @file config/prisma.ts
 * @description Initialises and exports the Prisma client and database lifecycle helpers.
 * Uses `@prisma/adapter-pg` so the client connects via the pg driver with the
 * `DATABASE_URL` connection string from the validated environment configuration.
 */

import { PrismaClient } from '../../prisma/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';
import { logger } from './logger';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

/** Singleton Prisma client used across all data-access modules. */
export const prisma = new PrismaClient({ adapter });

/**
 * Opens the Prisma database connection. Should be called once at application
 * startup before the HTTP server begins accepting requests.
 *
 * @throws Re-throws any connection error after logging it.
 */
export const connectToDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Connected to database');
  } catch (error) {
    logger.error('Error connecting to database');
    throw error;
  }
};

/**
 * Gracefully closes the Prisma database connection. Should be called during
 * application shutdown (e.g. on SIGTERM) to release connection pool resources.
 *
 * @throws Re-throws any disconnection error after logging it.
 */
export const disconnectFromDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Disconnected from database');
  } catch (error) {
    logger.error('Error disconnecting from database');
    throw error;
  }
};
