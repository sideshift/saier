import 'reflect-metadata';
import { Entity, Column, PrimaryColumn, OneToMany, ManyToOne, createConnection } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as pMemoize from 'p-memoize';
import { Config } from './config';

export enum SystemAccountId {
  funding = 'funding',
}

@Entity()
/**
 * Account with a balance, either for a user or system account
 */
export class Account {
  @PrimaryColumn('text')
  /**
   * Unique identifier for the account. Telegram unique id is used for user accounts,
   * hard coded
   */
  readonly id!: string | SystemAccountId;

  @Column('timestamptz', { generated: true })
  readonly createdAt!: string;

  @Column('text', { nullable: true })
  readonly username?: string | null;

  @Column('numeric')
  readonly balance!: string;

  @OneToMany(
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    _type => SideshiftOrder,
    order => order.account
  )
  readonly orders!: SideshiftOrder[];

  @OneToMany(
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    _type => Transfer,
    transfer => transfer.fromAccount
  )
  readonly transfersOut!: Transfer[];

  @OneToMany(
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    _type => Transfer,
    transfer => transfer.toAccount
  )
  readonly transfersIn!: Transfer[];
}

@Entity()
export class SideshiftOrder {
  @PrimaryColumn()
  readonly id!: string;

  @Column()
  readonly accountId!: string;

  @Column('timestamptz', { generated: true })
  readonly createdAt!: string;

  @ManyToOne(
    _type => Account,
    account => account.orders,
    { eager: true }
  )
  readonly account!: Account;

  @Column()
  readonly depositMethodId!: string;

  @OneToMany(
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    _type => SideshiftDeposit,
    deposit => deposit.order
  )
  readonly deposits!: SideshiftDeposit[];
}

@Entity()
export class SideshiftDeposit {
  @PrimaryColumn()
  readonly id!: string;

  @Column()
  readonly orderId!: string;

  @ManyToOne(
    _type => SideshiftOrder,
    order => order.deposits,
    { eager: true }
  )
  readonly order!: SideshiftOrder;

  @Column()
  readonly createdAt!: string;

  @Column()
  status!: string;
}

@Entity()
export class Transfer {
  @PrimaryColumn()
  readonly id!: string;

  @Column()
  readonly createdAt!: string;

  @Column()
  readonly fromAccountId!: string;

  @ManyToOne(
    _type => Account,
    account => account.transfersOut,
    { eager: true }
  )
  readonly fromAccount!: Account;

  @Column()
  readonly toAccountId!: string;

  @ManyToOne(
    _type => Account,
    account => account.transfersIn,
    { eager: true }
  )
  readonly toAccount!: Account;

  @Column('numeric')
  readonly amount!: string;

  @Column('text', { nullable: true })
  readonly internalRef?: string | null;
}

export const connection = pMemoize(async (config: Config) => {
  const ssl = process.env.PGSSLMODE === 'off' ? false : { rejectUnauthorized: false };

  return createConnection({
    type: 'postgres',
    url: config.databaseUrl,
    entities: [Account, SideshiftOrder, SideshiftDeposit, Transfer],
    logging: true,
    namingStrategy: new SnakeNamingStrategy(),
    extra: { ssl },
  });
});
