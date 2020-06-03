import saiCommandHandler from './sai';
import balanceCommandHandler from './balance';
import startCommandHandler from './start';
import withdrawCommandHandler from './withdraw';
import depositCommandHandler from './deposit';
import { CommandHandler } from '../types';

const handlers: Record<string, CommandHandler> = {
  sai: saiCommandHandler,
  balance: balanceCommandHandler,
  start: startCommandHandler,
  withdraw: withdrawCommandHandler,
  deposit: depositCommandHandler,
};

export default handlers;
