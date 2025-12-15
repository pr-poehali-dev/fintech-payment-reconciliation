-- Добавить notify_on_canceled в webhook_settings для всех интеграций Tbank
UPDATE t_p83864310_fintech_payment_reco.user_integrations 
SET webhook_settings = jsonb_set(
    COALESCE(webhook_settings, '{}'::jsonb), 
    '{notify_on_canceled}', 
    'true'
)
WHERE provider_id = (
    SELECT id FROM t_p83864310_fintech_payment_reco.integration_providers WHERE slug = 'tbank'
)
AND NOT (webhook_settings::jsonb ? 'notify_on_canceled');