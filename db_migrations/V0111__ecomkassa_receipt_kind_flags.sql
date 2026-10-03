ALTER TABLE t_p83864310_fintech_payment_reco.ecomkassa_receipts
    ADD COLUMN IF NOT EXISTS is_sale BOOLEAN NULL,
    ADD COLUMN IF NOT EXISTS is_correction BOOLEAN NULL;