INSERT INTO t_p83864310_fintech_payment_reco.automation_action_templates
    (code, action_type, name, description, operation, paid, is_active, sort_order, protocol_version, receipt_type, payment_method, payment_object, measure, payment_type)
SELECT 'advance_offset_service', 'create_receipt', 'Зачёт аванса за услугу ФФД 1.1',
       'Услуга оказана (занятие проведено) - полный расчёт с зачётом ранее полученной предоплаты: признак «полный расчёт», предмет «услуга», оплата «предварительная оплата (аванс)»',
       'sell', true, true, 61, 'v4', 'regular', 'full_payment', 'service', 'piece', 2
WHERE NOT EXISTS (SELECT 1 FROM t_p83864310_fintech_payment_reco.automation_action_templates WHERE code = 'advance_offset_service');