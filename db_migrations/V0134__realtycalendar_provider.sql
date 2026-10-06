INSERT INTO t_p83864310_fintech_payment_reco.integration_providers (category_id, name, slug, logo_url, description, webhook_enabled, status)
SELECT c.id, 'RealtyCalendar', 'realtycalendar', '', 'CRM для посуточной аренды: чеки по платежам броней', true, 'active'
FROM t_p83864310_fintech_payment_reco.integration_categories c WHERE c.slug = 'crm'
AND NOT EXISTS (SELECT 1 FROM t_p83864310_fintech_payment_reco.integration_providers WHERE slug = 'realtycalendar');

INSERT INTO t_p83864310_fintech_payment_reco.automation_action_templates
    (code, action_type, name, description, operation, paid, is_active, sort_order, protocol_version, receipt_type, payment_method, payment_object, measure, payment_type)
SELECT 'refund_prepayment_service', 'create_receipt', 'Возврат предоплаты за услугу ФФД 1.1',
       'Возврат ранее полученной предоплаты: операция «возврат прихода», признак «предоплата 100%», предмет «услуга»',
       'sell_refund', true, true, 62, 'v4', 'regular', 'full_prepayment', 'service', 'piece', 1
WHERE NOT EXISTS (SELECT 1 FROM t_p83864310_fintech_payment_reco.automation_action_templates WHERE code = 'refund_prepayment_service');