ALTER TABLE t_p83864310_fintech_payment_reco.ecomkassa_receipts ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'ecomkassa';
ALTER TABLE t_p83864310_fintech_payment_reco.ecomkassa_receipts ADD COLUMN IF NOT EXISTS merged_into_id INTEGER NULL;
ALTER TABLE t_p83864310_fintech_payment_reco.payment_carts ADD COLUMN IF NOT EXISTS receipt_id INTEGER NULL;
ALTER TABLE t_p83864310_fintech_payment_reco.payment_carts ADD COLUMN IF NOT EXISTS fiscalized BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_ecomkassa_receipts_fiscal ON t_p83864310_fintech_payment_reco.ecomkassa_receipts (company_id, (raw_data->'payload'->>'fn_number'), (raw_data->'payload'->>'fiscal_document_number')) WHERE removed_at IS NULL;