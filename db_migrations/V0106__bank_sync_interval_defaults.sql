UPDATE t_p83864310_fintech_payment_reco.user_integrations SET sync_interval_hours = 1, config = config || '{"sync_interval_hours": "1"}'::jsonb WHERE id = 25;
UPDATE t_p83864310_fintech_payment_reco.user_integrations ui SET sync_interval_hours = 24
FROM t_p83864310_fintech_payment_reco.integration_providers p
WHERE p.id = ui.provider_id AND p.slug IN ('tbank_account', 'tochka_account', 'modulbank_account') AND ui.sync_interval_hours IS NULL;