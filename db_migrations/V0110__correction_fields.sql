ALTER TABLE t_p83864310_fintech_payment_reco.automation_action_templates
    ADD COLUMN IF NOT EXISTS correction_base_name VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS payment_address VARCHAR(256) NULL;
ALTER TABLE t_p83864310_fintech_payment_reco.automation_scenarios
    ADD COLUMN IF NOT EXISTS correction_settings JSONB NULL;