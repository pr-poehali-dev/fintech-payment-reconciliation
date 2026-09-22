ALTER TABLE t_p83864310_fintech_payment_reco.crm_deals
    ADD COLUMN IF NOT EXISTS webhook_count integer NOT NULL DEFAULT 1;

ALTER TABLE t_p83864310_fintech_payment_reco.webhook_events
    ADD COLUMN IF NOT EXISTS external_deal_id character varying(100);