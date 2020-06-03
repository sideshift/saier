import { CommandHandler } from '../types';

const startCommandHandler: CommandHandler = async ctx => {
  if (ctx.chat?.type === 'private') {
    await ctx.reply(`You're all set! Next try /deposit`);
  } else {
    await ctx.reply(`You're all set, @${ctx.username}`);
  }
};

export default startCommandHandler;
