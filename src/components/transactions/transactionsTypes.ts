export type TransactionType = 'payment' | 'receipt_ofd' | 'receipt_kassa' | 'receipt_order' | 'money';

export type MatchMethod = 'receipt_id' | 'order_id' | 'fiscal_triplet' | 'automation' | string | null;

export interface WebhookHistoryItem {
  status: string | null;
  occurred_at: string | null;
}

export interface Transaction {
  type: TransactionType;
  source: string;
  id: number;
  occurred_at: string | null;
  settlement_date?: string | null;
  amount: number | null;
  signed_amount: number | null;
  status: string | null;
  title: string;
  subtitle: string | null;
  integration_name: string | null;
  reference: string | null;
  raw_data: unknown;
  linked_type: TransactionType | null;
  linked_source: string | null;
  linked_id: number | null;
  match_method: MatchMethod;
  manual_group_id: string | null;
  link_excluded?: boolean;
  webhook_history?: WebhookHistoryItem[];
}

export interface TransactionTypeTotal {
  count: number;
  amount: number;
  matched_count: number;
}

export type TransactionTotalsByType = Partial<Record<TransactionType, TransactionTypeTotal>>;