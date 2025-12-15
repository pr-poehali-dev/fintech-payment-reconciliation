-- Добавить api_url для демо-касс ОФД
UPDATE t_p83864310_fintech_payment_reco.user_integrations 
SET config = jsonb_set(
    config::jsonb, 
    '{api_url}', 
    '"https://demo.ofd.ru"'
)
WHERE provider_id = (
    SELECT id FROM t_p83864310_fintech_payment_reco.integration_providers WHERE slug = 'ofdru'
)
AND integration_name ILIKE '%демо%';

-- Обновить config для всех ОФД интеграций без api_url на продакшн
UPDATE t_p83864310_fintech_payment_reco.user_integrations 
SET config = jsonb_set(
    config::jsonb, 
    '{api_url}', 
    '"https://ofd.ru"'
)
WHERE provider_id = (
    SELECT id FROM t_p83864310_fintech_payment_reco.integration_providers WHERE slug = 'ofdru'
)
AND NOT (config::jsonb ? 'api_url');