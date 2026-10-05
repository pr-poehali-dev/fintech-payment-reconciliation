ALTER TABLE t_p83864310_fintech_payment_reco.webhook_events ALTER COLUMN origin SET DEFAULT NULL;
ALTER TABLE t_p83864310_fintech_payment_reco.webhook_payments ALTER COLUMN origin SET DEFAULT NULL;
ALTER TABLE t_p83864310_fintech_payment_reco.ecomkassa_receipts ALTER COLUMN origin SET DEFAULT NULL;
ALTER TABLE t_p83864310_fintech_payment_reco.ofd_receipts ALTER COLUMN origin SET DEFAULT NULL;
ALTER TABLE t_p83864310_fintech_payment_reco.bank_statement_transactions ALTER COLUMN origin SET DEFAULT NULL;
UPDATE t_p83864310_fintech_payment_reco.webhook_events SET origin = 'recovery' WHERE origin IS NULL AND raw_payload->>'source' = 'cron_recovery';
UPDATE t_p83864310_fintech_payment_reco.webhook_events SET origin = 'webhook' WHERE origin IS NULL;
UPDATE t_p83864310_fintech_payment_reco.ecomkassa_receipts SET origin = 'manual' WHERE id = 867;
UPDATE t_p83864310_fintech_payment_reco.webhook_payments SET origin = 'manual' WHERE id = 97;