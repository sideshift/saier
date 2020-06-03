import * as orm from '../orm';
import { CommandHandler } from '../types';

const withdrawCommandHandler: CommandHandler = async ctx => {
  const { conn, sideshiftClient, config } = ctx;

  if (ctx.chat?.type !== 'private') {
    await ctx.reply(`Command must be used in a private chat`);
    return;
  }

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
    if (error.message.match(/account_check/)) {
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
};

export default withdrawCommandHandler;
