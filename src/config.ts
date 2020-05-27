import * as path from 'path';
import { memoize } from 'lodash';

const required = (key: string, env = process.env): string => {
  const value = env[key];

  if (value === undefined) {
    throw new Error(`${env} is required`);
  }

  return value;
};

export const readConfig = memoize((env = process.env) => ({
  databaseFilename: path.join(__dirname, '../', env.DATABASE_FILENAME || 'saier.db'),
  sideshiftSecret: required('SAIER_SIDESHIFT_SECRET'),
  telegramToken: required('SAIER_TELEGRAM_TOKEN'),
  affiliate: required('SAIER_SIDESHIFT_AFFILIATE'),
  sideshiftBaseUrl: env.SIDESHIFT_BASE_URL,
}));

export type Config = ReturnType<typeof readConfig>;
