ALTER TABLE t_p83864310_fintech_payment_reco.automation_action_templates
    ADD COLUMN auto_deliver BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN cashier_name VARCHAR(100) NULL;