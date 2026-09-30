ALTER TABLE t_p83864310_fintech_payment_reco.automation_action_templates
    ADD COLUMN provider_id INTEGER NULL REFERENCES t_p83864310_fintech_payment_reco.integration_providers(id),
    ADD COLUMN protocol_version VARCHAR(5) NOT NULL DEFAULT 'v4',
    ADD COLUMN receipt_type VARCHAR(20) NOT NULL DEFAULT 'regular',
    ADD COLUMN payment_method VARCHAR(30) NOT NULL DEFAULT 'full_payment',
    ADD COLUMN payment_object VARCHAR(30) NOT NULL DEFAULT 'commodity',
    ADD COLUMN measure VARCHAR(20) NOT NULL DEFAULT 'piece',
    ADD COLUMN payment_type SMALLINT NULL,
    ADD COLUMN default_email VARCHAR(255) NULL;

UPDATE t_p83864310_fintech_payment_reco.automation_action_templates
SET provider_id = (SELECT id FROM t_p83864310_fintech_payment_reco.integration_providers WHERE slug = 'ecomkassa'),
    payment_type = CASE WHEN paid THEN 1 ELSE NULL END;

UPDATE t_p83864310_fintech_payment_reco.automation_action_templates
SET receipt_type = 'correction', operation = 'sell'
WHERE code = 'correction';