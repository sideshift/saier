import { Connection } from 'typeorm';
import Telegraf from 'telegraf';
import * as sideshift from '@sideshift/toolkit';
import { createHooksReceiver } from '@sideshift/toolkit/hooks/express';
import { BotContext } from './types';
import * as orm from './orm';
import { Config } from './config';

const create = ({
  bot,
  conn,
  config,
}: {
  bot: Telegraf<BotContext>;
  conn: Connection;
  config: Config;
}) => {
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

  return createHooksReceiver({
    port: +process.env.PORT!,
    secret: config.sideshiftSecret,
    onDepositCreate: handleDepositHook,
    onDepositUpdate: handleDepositHook,
  });
};

export default create;
