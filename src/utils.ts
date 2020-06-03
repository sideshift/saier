import { memoize } from 'lodash';
import { Connection } from 'typeorm';
import * as orm from './orm';

export const getOrCreateAccountForTelegramUser = async (
  conn: Connection,
  telegramUserId: string,
  username: string
): Promise<orm.Account> => {
  const account = await conn.getRepository(orm.Account).findOne(telegramUserId);

  if (account) {
    return account;
  }

  await conn.getRepository(orm.Account).save(
    Object.assign(new orm.Account(), {
      id: telegramUserId,
      username,
      createdAt: new Date().toISOString(),
    })
  );

  return getOrCreateAccountForTelegramUser(conn, telegramUserId, username);
};

export const getProcessExitPromise = memoize(
  () =>
    new Promise<void>(resolve => {
      process.on('SIGINT', () => resolve());
      process.on('SIGTERM', () => resolve());
    })
);
