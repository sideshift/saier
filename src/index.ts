/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Telegraf, Context as TelegrafContext } from 'telegraf';
import * as sideshift from '@sideshift/toolkit';
import { readConfig } from './config';
import * as orm from './orm';

type BotContext = TelegrafContext & {
  username: string;
  userId: string;
  args: string[];
  account: orm.Account;
};

const main = async (): Promise<void> => {
  const config = readConfig();

  const conn = await orm.connection(config);

  const sideshiftClient = sideshift.createClient({
    secret: config.sideshiftSecret,
    ...(config.sideshiftBaseUrl ? { baseUrl: config.sideshiftBaseUrl } : {}),
  });

  const sideshiftFacts = await sideshiftClient.getFacts();

  const bot = new Telegraf<BotContext>(config.telegramToken);

  const handleDepositHook = async (
    message: sideshift.DepositCreateHookDelivery | sideshift.DepositUpdateHookDelivery
  ): Promise<void> => {
    const { payload } = message;
    const { orderId } = payload;

    console.log(`Processing hook for deposit ${payload.id}, order ${payload.orderId}`);

    const order = await conn.getRepository(orm.SideshiftOrder).findOne(orderId);

    if (!order) {
      console.error(`Received hook for unknown order ${payload.orderId}`);
      return;
    }

    let deposit = await conn.getRepository(orm.SideshiftDeposit).findOne(payload.id);

    const prevStatus = deposit?.status;

    if (!deposit) {
      deposit = Object.assign(new orm.SideshiftDeposit(), {
        id: payload.id,
        createdAt: payload.createdAtISO,
        orderId: order.id,
        status: payload.status,
      });
    } else if (deposit.status !== payload.status) {
      deposit.status = payload.status;
    } else {
      console.log(`Ignoring unchanged deposit ${payload.id} with status ${payload.status}`);
      return;
    }

    const credited = await conn.transaction(async t => {
      await t.getRepository(orm.SideshiftDeposit).save(deposit!);

      if (prevStatus === 'settled' || deposit!.status !== 'settled') {
        return false;
      }

      await t.getRepository(orm.Transfer).save(
        Object.assign(new orm.Transfer(), {
          id: deposit?.id,
          createdAt: new Date().toISOString(),
          fromAccountId: 'funding',
          toAccountId: order.accountId,
          amount: payload.settleAmount!,
        })
      );

      return true;
    });

    if (!credited) {
      return;
    }

    await bot.telegram.sendMessage(
      order.account.id,
      `You've been credited with ${payload.settleAmount!} SAI`
    );
  };

  sideshift.createHooksReceiver({
    port: +process.env.PORT!,
    secret: config.sideshiftSecret,
    onDepositCreate: handleDepositHook,
    onDepositUpdate: handleDepositHook,
  });

  const getOrCreateAccountForTelegramUser = async (
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

    return getOrCreateAccountForTelegramUser(telegramUserId, username);
  };

  const commandWrapper = <T extends BotContext>(handler: (ctx: T) => Promise<void>) => async (
    ctx: T
  ): Promise<void> => {
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
      account: await getOrCreateAccountForTelegramUser(userId, username),
    });

    try {
      await handler(ctx);
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        await ctx.reply(`Error!`);
      } else {
        await ctx.reply(error.stack);
      }

      console.error(error.stack);
    }
  };

  bot.command(
    'balance',
    commandWrapper(async ctx => {
      await ctx.reply(`${ctx.account.balance} SAI`);
    })
  );

  bot.command(
    'start',
    commandWrapper(async ctx => {
      if (ctx.chat?.type === 'private') {
        await ctx.reply(`You're all set! Next try /deposit`);
      } else {
        await ctx.reply(`You're all set, @${ctx.username}`);
      }
    })
  );

  bot.command(
    'sai',
    commandWrapper(async ctx => {
      const usage = () => ctx.reply(`Usage: /sai @username <amount>. Example: /sai @brekken 10`);

      const { args, account } = ctx;

      if (args.length < 2) {
        await usage();
        return;
      }

      const [receiverRaw, amountRaw] = args;

      const receiverUsername = receiverRaw.match(/^@([a-z0-9_]+)$/i)?.[1];

      if (!receiverUsername) {
        await usage();
        return;
      }

      const receiver = await conn
        .getRepository(orm.Account)
        .findOne({ username: receiverUsername });

      if (!receiver) {
        await ctx.reply(`I don't know who @${receiverUsername} is. Have them say /sai`);
        return;
      }

      const amount = parseFloat(amountRaw);

      if (!(amount > 0)) {
        await usage();
        return;
      }

      try {
        await conn.getRepository(orm.Transfer).save(
          Object.assign(new orm.Transfer(), {
            id: new Date().getTime().toString(),
            createdAt: new Date().toISOString(),
            fromAccountId: account.id,
            toAccountId: receiver.id,
            amount: amount.toString(),
          })
        );
      } catch (error) {
        if (error.message.match(/CHECK constraint failed: account/)) {
          await ctx.reply(`Insufficient funds`);
          return;
        }
      }

      await ctx.reply(`You tipped ${amount} SAI to @${receiverUsername}`);
    })
  );

  bot.command(
    'withdraw',
    commandWrapper(async ctx => {
      const usage = () =>
        ctx.reply(
          `Usage: /withdraw <btc/bch> <address> <amount in sai>. Example: /withdraw bch bitcoincash:qqu0fl22ar6r66m3y03w33d6sd9hmuwp3qnkwckjmh 1000`
        );

      const { args, account } = ctx;

      if (args.length !== 3) {
        await usage();
        return;
      }

      const [settleMethodId, address, amountRaw] = args;

      const amount = parseFloat(amountRaw);

      if (!(amount > 0)) {
        await usage();
        return;
      }

      let transfer: orm.Transfer;

      try {
        transfer = await conn.getRepository(orm.Transfer).save(
          Object.assign(new orm.Transfer(), {
            id: new Date().getTime().toString(),
            createdAt: new Date().toISOString(),
            fromAccountId: account.id,
            toAccountId: 'funding',
            amount: amount.toString(),
          })
        );
      } catch (error) {
        if (error.message.match(/CHECK constraint failed: account/)) {
          await ctx.reply(`Insufficient funds`);
          return;
        }

        throw error;
      }

      const order = await sideshiftClient.createOrder({
        affiliateId: config.affiliate,
        sessionSecret: config.sideshiftSecret,
        depositMethodId: 'saibal',
        settleMethodId,
        settleAddress: address,
        amount: amount.toString(),
      });

      console.log(
        `Created order ${order.id} for withdraw request from ${ctx.username} with transfer ${transfer.id}`
      );

      await ctx.reply(`OK!`);
    })
  );

  bot.command(
    'deposit',
    commandWrapper(async ctx => {
      if (ctx.chat?.type !== 'private') {
        await ctx.reply(`Command must be used in a private chat`);
        return;
      }

      const { args } = ctx;

      if (args.length !== 1) {
        await ctx.reply(
          `Usage: /deposit <method>\nExample: /deposit bch\nSee /methods for list of deposit methods`
        );
        return;
      }

      const [depositMethodId] = args;

      const order = await sideshiftClient.createOrder({
        affiliateId: config.affiliate,
        sessionSecret: config.sideshiftSecret,
        depositMethodId,
        settleMethodId: 'saibal',
        settleAddress: config.affiliate,
      });

      console.log(
        `Created order ${order.id} for user ${ctx.username} to deposit ${depositMethodId}`
      );

      await conn.getRepository(orm.SideshiftOrder).insert(
        Object.assign(new orm.SideshiftOrder(), {
          id: order.id,
          createdAt: order.createdAtISO,
          accountId: ctx.account.id,
          depositMethodId: order.depositMethodId,
        })
      );

      const depositMethod = sideshiftFacts.depositMethods[depositMethodId]!;

      await ctx.reply(`Send ${depositMethod.asset} to ${order.depositAddress.address!}`);
    })
  );

  await bot.launch();
  console.log('Bot online!');

  await new Promise(_resolve => {});
};

main()
  .then(() => process.exit())
  .catch(error => {
    console.error(error.stack);
    process.exit(1);
  });
