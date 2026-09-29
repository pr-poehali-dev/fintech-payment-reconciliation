export interface EventWebhookHistoryItem {
  id: number;
  status: string | null;
  error_message: string | null;
  created_at: string | null;
  raw: any;
  event_type: string | null;
}

export type EventTransactionType = 'payment' | 'receipt' | 'receipt_order' | 'money' | 'crm';

export interface AppEvent {
  id: string;
  source: 'payment' | 'crm' | 'bank_statement';
  created_at: string | null;
  provider_slug: string;
  provider_type: string;
  transaction_type: EventTransactionType;
  payment_provider?: string | null;
  integration_name: string;
  event_type: string | null;
  status: string | null;
  error_message: string | null;
  event_number: string | null;
  summary: string;
  raw: any;
  webhook_history?: EventWebhookHistoryItem[];
}