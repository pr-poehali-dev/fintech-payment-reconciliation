ALTER TABLE t_p83864310_fintech_payment_reco.webhook_events ALTER COLUMN origin SET DEFAULT NULLIF(current_setting('app.origin', true), '');
ALTER TABLE t_p83864310_fintech_payment_reco.webhook_payments ALTER COLUMN origin SET DEFAULT NULLIF(current_setting('app.origin', true), '');
ALTER TABLE t_p83864310_fintech_payment_reco.ecomkassa_receipts ALTER COLUMN origin SET DEFAULT NULLIF(current_setting('app.origin', true), '');
ALTER TABLE t_p83864310_fintech_payment_reco.ofd_receipts ALTER COLUMN origin SET DEFAULT NULLIF(current_setting('app.origin', true), '');
ALTER TABLE t_p83864310_fintech_payment_reco.bank_statement_transactions ALTER COLUMN origin SET DEFAULT NULLIF(current_setting('app.origin', true), '');