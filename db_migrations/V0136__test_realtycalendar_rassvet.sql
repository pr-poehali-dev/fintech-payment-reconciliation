INSERT INTO t_p83864310_fintech_payment_reco.user_integrations (provider_id, integration_name, webhook_token, config, status, company_id)
SELECT p.id, v.name, v.token, v.cfg::jsonb, 'active', 4
FROM t_p83864310_fintech_payment_reco.integration_providers p
CROSS JOIN (VALUES
  ('ТЕСТ RealtyCalendar — платежи', 'rk_test_rassvet_income_5b8e1f3a7c294d06', '{"stage": "income", "payment_systems": ["manual"], "include_deposits": false}'),
  ('ТЕСТ RealtyCalendar — возвраты', 'rk_test_rassvet_refund_9d2c6a4e81f70b35', '{"stage": "refund", "payment_systems": ["manual"], "include_deposits": false}')
) AS v(name, token, cfg)
WHERE p.slug = 'realtycalendar'
AND NOT EXISTS (SELECT 1 FROM t_p83864310_fintech_payment_reco.user_integrations WHERE webhook_token = v.token);