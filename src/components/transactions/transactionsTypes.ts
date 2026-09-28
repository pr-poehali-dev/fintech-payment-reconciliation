export type TransactionType = 'payment' | 'receipt' | 'money';

export interface Transaction {
  type: TransactionType;
  id: number;
  occurred_at: string | null;
  amount: number | null;
  status: string | null;
  title: string;
  subtitle: string | null;
  integration_name: string | null;
  reference: string | null;
  receipt_id: number | null;
  raw_data: any;
}

export interface TransactionTypeTotal {
  count: number;
  amount: number;
}

export type TransactionTotalsByType = Partial<Record<TransactionType, TransactionTypeTotal>>;
