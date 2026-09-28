export type TransactionType = 'payment' | 'receipt' | 'money';

export type MatchMethod = 'receipt_id' | 'order_id' | 'fiscal_triplet' | null;

export interface Transaction {
  type: TransactionType;
  source: string;
  id: number;
  occurred_at: string | null;
  amount: number | null;
  status: string | null;
  title: string;
  subtitle: string | null;
  integration_name: string | null;
  reference: string | null;
  raw_data: any;
  linked_type: TransactionType | null;
  linked_source: string | null;
  linked_id: number | null;
  match_method: MatchMethod;
}

export interface TransactionTypeTotal {
  count: number;
  amount: number;
  matched_count: number;
}

export type TransactionTotalsByType = Partial<Record<TransactionType, TransactionTypeTotal>>;