import { CommandHandler } from '../types';

const balanceCommandHandler: CommandHandler = async ctx => {
  await ctx.reply(`${ctx.account.balance} SAI`);
};

export default balanceCommandHandler;
