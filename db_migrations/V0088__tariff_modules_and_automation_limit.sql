ALTER TABLE t_p83864310_fintech_payment_reco.tariffs
    ADD COLUMN modules JSONB NOT NULL DEFAULT '["reconciliation","events","transactions","automation","integrations","access","settings"]'::jsonb,
    ADD COLUMN max_automations INTEGER NULL;

UPDATE t_p83864310_fintech_payment_reco.tariffs SET name = 'Пробный', max_automations = 1 WHERE slug = 'trial';
UPDATE t_p83864310_fintech_payment_reco.tariffs SET max_automations = 3 WHERE slug = 'start';
UPDATE t_p83864310_fintech_payment_reco.tariffs SET max_automations = 20 WHERE slug = 'business';