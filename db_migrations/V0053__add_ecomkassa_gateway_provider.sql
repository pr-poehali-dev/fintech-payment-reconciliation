-- Платёжный шлюз Екомкассы (payments.ecomkassa.ru / app.ecomkassa.ru) - проксирует
-- запросы в банковские эквайринги (Точка, Тинькофф и т.д.) по единому протоколу.
-- Отдельный провайдер от кассы "Екомкасса" (ecomkassa, category=cash_registers) -
-- здесь идут именно платежи, поэтому категория "payments", как у tbank/tochka/yookassa.
INSERT INTO t_p83864310_fintech_payment_reco.integration_providers
    (category_id, name, slug, logo_url, description, webhook_enabled, status)
SELECT c.id, 'Екомкасса — платёжный шлюз', 'ecomkassa_gateway', '',
       'Приём платежей через прокси-шлюз payments.ecomkassa.ru (invoice), с довязкой чека из кассы Екомкасса по общему UUID',
       true, 'active'
FROM t_p83864310_fintech_payment_reco.integration_categories c
WHERE c.slug = 'payments'
  AND NOT EXISTS (
    SELECT 1 FROM t_p83864310_fintech_payment_reco.integration_providers WHERE slug = 'ecomkassa_gateway'
  );
