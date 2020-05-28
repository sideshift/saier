import { memoize } from 'lodash';

const required = (key: string, env = process.env): string => {
  const value = env[key];

  if (value === undefined) {
    throw new Error(`${env} is required`);
  }

  return value;
};

/**
 * Read configuration from environment variables with defaults.
 */
export const readConfig = memoize((env = process.env) => ({
  databaseUrl: env.DATABASE_URL || 'postgres://localhost/saier_dev',
  sideshiftSecret: required('SAIER_SIDESHIFT_SECRET'),
  telegramToken: required('SAIER_TELEGRAM_TOKEN'),
  affiliate: required('SAIER_SIDESHIFT_AFFILIATE'),
  ...(env.SIDESHIFT_BASE_URL ? { sideshiftBaseUrl: env.SIDESHIFT_BASE_URL } : {}),
}));

export type Config = ReturnType<typeof readConfig>;
