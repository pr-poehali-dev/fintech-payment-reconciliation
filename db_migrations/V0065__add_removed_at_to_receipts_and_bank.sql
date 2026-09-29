ALTER TABLE t_p83864310_fintech_payment_reco.ecomkassa_receipts
ADD COLUMN removed_at TIMESTAMP NULL;

ALTER TABLE t_p83864310_fintech_payment_reco.ofd_receipts
ADD COLUMN removed_at TIMESTAMP NULL;

ALTER TABLE t_p83864310_fintech_payment_reco.bank_statement_transactions
ADD COLUMN removed_at TIMESTAMP NULL;
