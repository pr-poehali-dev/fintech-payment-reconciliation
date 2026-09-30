import { TransactionType } from '@/components/transactions/transactionsTypes';

export interface TypeFilter {
  label: string;
  types: TransactionType[];
}

export const TYPE_FILTERS = {
  payments: { label: 'Платежи', types: ['payment'] },
  receipts: { label: 'Чеки', types: ['receipt_kassa', 'receipt_order', 'receipt_ofd'] },
  money: { label: 'Деньги', types: ['money'] }
} satisfies Record<string, TypeFilter>;

export type TypeFilterKey = keyof typeof TYPE_FILTERS;
