ALTER TABLE t_p83864310_fintech_payment_reco.crm_deals
    ADD COLUMN IF NOT EXISTS customer_emails TEXT NULL,
    ADD COLUMN IF NOT EXISTS linked_receipt_id INTEGER NULL,
    ADD COLUMN IF NOT EXISTS linked_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS link_checked_at TIMESTAMP NULL;
ALTER TABLE t_p83864310_fintech_payment_reco.ecomkassa_receipts
    ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS customer_checked BOOLEAN NOT NULL DEFAULT false;