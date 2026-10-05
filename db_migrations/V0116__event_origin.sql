ALTER TABLE t_p83864310_fintech_payment_reco.webhook_events ADD COLUMN IF NOT EXISTS origin varchar(20);
ALTER TABLE t_p83864310_fintech_payment_reco.webhook_payments ADD COLUMN IF NOT EXISTS origin varchar(20);
ALTER TABLE t_p83864310_fintech_payment_reco.ecomkassa_receipts ADD COLUMN IF NOT EXISTS origin varchar(20);
ALTER TABLE t_p83864310_fintech_payment_reco.ofd_receipts ADD COLUMN IF NOT EXISTS origin varchar(20);
ALTER TABLE t_p83864310_fintech_payment_reco.bank_statement_transactions ADD COLUMN IF NOT EXISTS origin varchar(20);
UPDATE t_p83864310_fintech_payment_reco.webhook_events SET origin = CASE WHEN raw_payload->>'source' = 'cron_recovery' THEN 'cron' ELSE 'webhook' END WHERE origin IS NULL;