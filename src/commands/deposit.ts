import * as orm from '../orm';
import { CommandHandler } from '../types';

const depositCommandHandler: CommandHandler = async ctx => {
  const { sideshiftClient, config, conn, sideshiftFacts } = ctx;

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

  console.log(`Created order ${order.id} for user ${ctx.username} to deposit ${depositMethodId}`);

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
};

export default depositCommandHandler;
