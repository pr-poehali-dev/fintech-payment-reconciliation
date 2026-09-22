INSERT INTO t_p83864310_fintech_payment_reco.integration_providers
    (category_id, name, slug, logo_url, description, webhook_enabled, status)
VALUES
    (2, 'Екомкасса', 'ecomkassa', '', 'Загрузка чеков через API Екомкассы (fiscalorder v4/v5)', false, 'active')
ON CONFLICT (slug) DO NOTHING;