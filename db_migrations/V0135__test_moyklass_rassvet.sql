INSERT INTO t_p83864310_fintech_payment_reco.user_integrations (provider_id, integration_name, webhook_token, config, status, company_id)
SELECT p.id, v.name, v.token, v.cfg::jsonb, 'active', 4
FROM t_p83864310_fintech_payment_reco.integration_providers p
CROSS JOIN (VALUES
  ('ТЕСТ Мой Класс — оплаты', 'mk_test_rassvet_pay_7f3a9c2e51d84b6a', '{"api_key": "", "stage": "payment_new", "payment_type_ids": []}'),
  ('ТЕСТ Мой Класс — списания', 'mk_test_rassvet_debit_c41e8d7a92b05f3e', '{"api_key": "", "stage": "debit_new", "payment_type_ids": []}')
) AS v(name, token, cfg)
WHERE p.slug = 'moyklass'
AND NOT EXISTS (SELECT 1 FROM t_p83864310_fintech_payment_reco.user_integrations WHERE webhook_token = v.token);