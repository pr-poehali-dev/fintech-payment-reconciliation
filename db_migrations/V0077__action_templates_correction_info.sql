ALTER TABLE t_p83864310_fintech_payment_reco.automation_action_templates
    ADD COLUMN correction_type VARCHAR(20) NULL,
    ADD COLUMN correction_date_source VARCHAR(20) NULL,
    ADD COLUMN correction_base_date DATE NULL,
    ADD COLUMN correction_base_number VARCHAR(32) NULL;

UPDATE t_p83864310_fintech_payment_reco.automation_action_templates
SET correction_type = 'self', correction_date_source = 'payment'
WHERE receipt_type = 'correction';