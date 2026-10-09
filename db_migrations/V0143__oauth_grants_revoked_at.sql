ALTER TABLE t_p83864310_fintech_payment_reco.company_bank_oauth_grants
    ADD COLUMN IF NOT EXISTS revoked_at timestamp without time zone NULL;