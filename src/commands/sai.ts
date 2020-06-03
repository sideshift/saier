import * as orm from '../orm';
import { CommandHandler } from '../types';

const saiCommandHandler: CommandHandler = async ctx => {
  const { conn } = ctx;

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

  const receiver = await conn.getRepository(orm.Account).findOne({ username: receiverUsername });

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
    if (error.message.match(/account_check/)) {
      await ctx.reply(`Insufficient funds`);
      return;
    }

    throw error;
  }

  await ctx.reply(`You tipped ${amount} SAI to @${receiverUsername}`);
};

export default saiCommandHandler;
