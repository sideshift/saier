import 'reflect-metadata';
import * as sqlite3 from 'sqlite3';
import { open as openDb } from 'sqlite';
import { Entity, Column, PrimaryColumn, OneToMany, ManyToOne, createConnection } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as pMemoize from 'p-memoize';
import { Config } from './config';

const createNumericAsStringValueTransformer = (decimals: number) => ({
  to: (value: any): any =>
    typeof value === 'number' ? parseFloat(value.toFixed(decimals)).toString() : value.toString(),
  from: (value: any): any =>
    typeof value === 'number' ? parseFloat(value.toFixed(decimals)).toString() : value.toString(),
});

const saiAmountValueTransformer = createNumericAsStringValueTransformer(4);

@Entity()
export class Account {
  @PrimaryColumn()
  readonly id!: string;

  @Column()
  readonly createdAt!: string;

  @Column()
  readonly username!: string;

  @Column({ type: 'numeric', transformer: saiAmountValueTransformer })
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

  @Column()
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

  @Column({ type: 'numeric', transformer: saiAmountValueTransformer })
  readonly amount!: string;
}

export const connection = pMemoize(async (config: Config) => {
  const db = await openDb({
    filename: config.databaseFilename,
    driver: sqlite3.cached.Database,
  });

  await db.migrate();

  await db.close();

  return createConnection({
    type: 'sqlite',
    database: config.databaseFilename,
    entities: [Account, SideshiftOrder, SideshiftDeposit, Transfer],
    logging: true,
    namingStrategy: new SnakeNamingStrategy(),
  });
});
