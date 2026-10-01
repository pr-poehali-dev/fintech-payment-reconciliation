ALTER TABLE t_p83864310_fintech_payment_reco.tariffs
    ADD COLUMN period_days INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN yearly_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;

UPDATE t_p83864310_fintech_payment_reco.tariffs SET period_days = 7 WHERE slug = 'trial';