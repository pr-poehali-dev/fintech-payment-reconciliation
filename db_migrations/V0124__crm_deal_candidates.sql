ALTER TABLE t_p83864310_fintech_payment_reco.crm_deals ADD COLUMN IF NOT EXISTS candidate_receipt_id integer NULL;
ALTER TABLE t_p83864310_fintech_payment_reco.ecomkassa_receipts ADD COLUMN IF NOT EXISTS deal_search_at timestamp NULL;
ALTER TABLE t_p83864310_fintech_payment_reco.ecomkassa_receipts ADD COLUMN IF NOT EXISTS deal_candidate_at timestamp NULL;