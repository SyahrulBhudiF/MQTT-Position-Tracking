import { Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { AppConfigService } from '../config/config.service';
import * as schema from './schema';

export const DRIZZLE_PROVIDER = 'DRIZZLE_PROVIDER';

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Create a Drizzle database provider for NestJS dependency injection
 */
export const DrizzleProvider = {
  provide: DRIZZLE_PROVIDER,
  inject: [AppConfigService],
  useFactory: (configService: AppConfigService): DrizzleDB => {
    const logger = new Logger('DrizzleProvider');
    const config = configService.postgres;

    const connectionString = `postgres://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;

    logger.log(`Connecting to PostgreSQL at ${config.host}:${config.port}/${config.database}`);

    const client = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
    });

    const db = drizzle(client, {
      schema,
      logger: configService.isDevelopment(),
    });

    logger.log('Drizzle ORM initialized successfully');

    return db;
  },
};

/**
 * Create a standalone database connection (for migrations, scripts, etc.)
 */
export const createDatabaseConnection = (connectionString: string): DrizzleDB => {
  const client = postgres(connectionString, {
    max: 1,
  });

  return drizzle(client, { schema });
};
