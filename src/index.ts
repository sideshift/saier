import { Telegraf } from 'telegraf';
import * as sideshift from '@sideshift/toolkit';
import { Config } from './config';
import * as orm from './orm';
import commandHandlers from './commands';
import { BotContext } from './types';
import { getOrCreateAccountForTelegramUser, getProcessExitPromise } from './utils';
import createHooksReceiver from './hooks';

const main = async (config: Config): Promise<void> => {
  const conn = await orm.connection(config);

  const sideshiftClient = sideshift.createClient({
    secret: config.sideshiftSecret,
    ...(config.sideshiftBaseUrl ? { baseUrl: config.sideshiftBaseUrl } : {}),
  });

  const sideshiftFacts = await sideshiftClient.getFacts();

  const bot = new Telegraf<BotContext>(config.telegramToken);

  const hooks = createHooksReceiver({ bot, conn, config });

  // Hydrate context
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id.toString();

    if (!userId) {
      return;
    }

    const username = ctx.from?.username;

    if (!username) {
      await ctx.reply(`You need to set a username for your Telegram account`);
      return;
    }

    const args = ctx.message?.text?.split(/ /g).slice(1);

    if (!args) {
      return;
    }

    Object.assign(ctx, {
      userId,
      username,
      args,
      sideshiftFacts,
      conn,
      account: await getOrCreateAccountForTelegramUser(conn, userId, username),
    });

    await next();
  });

  // Command wrapper to add error handling
  bot.use(async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        await ctx.reply(`Error!`);
      } else {
        await ctx.reply(error.stack);
      }

      console.error(error.stack);
    }
  });

  // Add commands
  for (const commandName of Object.keys(commandHandlers)) {
    bot.command(commandName, commandHandlers[commandName]);
  }

  await bot.launch();

  console.log('Bot online!');

  await getProcessExitPromise();

  hooks.stop();
};

export default main;
