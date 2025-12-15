-- Добавление провайдера OFD.RU в категорию ОФД
INSERT INTO t_p83864310_fintech_payment_reco.integration_providers 
  (category_id, name, slug, logo_url, description, webhook_enabled, status)
VALUES 
  (3, 'OFD.RU', 'ofdru', 'https://cdn.poehali.dev/projects/logos/ofdru.svg', 'Загрузка чеков из ОФД', false, 'active')
ON CONFLICT DO NOTHING;