WITH new_int AS (
  INSERT INTO t_p83864310_fintech_payment_reco.user_integrations
    (legacy_owner_id_unused, provider_id, integration_name, webhook_token, config, status, webhook_settings, forward_url, company_id, sync_interval_hours)
  SELECT legacy_owner_id_unused, provider_id, integration_name, md5(random()::text || clock_timestamp()::text) || md5(random()::text), config, status, webhook_settings, forward_url, 4, sync_interval_hours
  FROM t_p83864310_fintech_payment_reco.user_integrations WHERE id = 15
  RETURNING id
)
INSERT INTO t_p83864310_fintech_payment_reco.automation_scenarios
  (company_id, name, trigger_type, source_integration_id, action_type, action_template, target_integration_id, field_mapping, status)
SELECT 4, s.name, s.trigger_type, new_int.id, s.action_type, s.action_template, 14, s.field_mapping, 'stopped'
FROM t_p83864310_fintech_payment_reco.automation_scenarios s, new_int
WHERE s.id = 5;