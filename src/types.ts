import { Connection } from 'typeorm';
import * as telegraf from 'telegraf';
import * as sideshift from '@sideshift/toolkit';
import * as orm from './orm';
import { Config } from './config';

export type BotContext = telegraf.Context & {
  username: string;
  userId: string;
  args: string[];
  account: orm.Account;
  conn: Connection;
  sideshiftClient: ReturnType<typeof sideshift.createClient>;
  config: Config;
  sideshiftFacts: sideshift.GetFactsResponse;
};

export type CommandHandler = <T extends BotContext>(context: T) => void | Promise<unknown>;

export { Config } from './config';
