ALTER TABLE t_p83864310_fintech_payment_reco.automation_action_templates
    ADD COLUMN agent_settings JSONB NULL;

COMMENT ON COLUMN t_p83864310_fintech_payment_reco.automation_action_templates.agent_settings IS
    'Агентский чек (АТОЛ Онлайн): agent_type, paying_agent_operation/phones, receive_payments_operator_phones, money_transfer_operator_*, supplier_*';