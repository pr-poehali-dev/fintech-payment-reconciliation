INSERT INTO t_p83864310_fintech_payment_reco.integration_providers (category_id, name, slug, logo_url, description, webhook_enabled, status)
SELECT c.id, 'Мой Класс', 'moyklass', '', 'CRM для школ и учебных центров: чеки по платежам учеников', true, 'active'
FROM t_p83864310_fintech_payment_reco.integration_categories c WHERE c.slug = 'crm'
AND NOT EXISTS (SELECT 1 FROM t_p83864310_fintech_payment_reco.integration_providers WHERE slug = 'moyklass');

INSERT INTO t_p83864310_fintech_payment_reco.automation_action_templates
    (code, action_type, name, description, operation, paid, is_active, sort_order, protocol_version, receipt_type, payment_method, payment_object, measure, payment_type)
SELECT 'prepayment_service', 'create_receipt', 'Чек предоплаты за услугу ФФД 1.1',
       'Оплата абонемента/обучения до оказания услуги: предоплата 100% (или частичная, если оплачена не вся сумма), предмет расчёта - услуга',
       'sell', true, true, 60, 'v4', 'regular', 'full_prepayment', 'service', 'piece', 1
WHERE NOT EXISTS (SELECT 1 FROM t_p83864310_fintech_payment_reco.automation_action_templates WHERE code = 'prepayment_service');