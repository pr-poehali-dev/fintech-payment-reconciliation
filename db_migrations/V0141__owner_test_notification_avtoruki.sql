WITH n AS (
    INSERT INTO t_p83864310_fintech_payment_reco.notifications (company_id, kind, level, title, message, link_module, entity_type, entity_id, payload)
    VALUES (5, 'test', 'info', 'Проверка уведомлений',
            'Это пробное сообщение: уведомления по компании «АВТОРУКИ» будут приходить сюда.',
            'notifications', 'test', 'owner-check-20261007', '{}'::jsonb)
    RETURNING id
)
INSERT INTO t_p83864310_fintech_payment_reco.notification_deliveries (notification_id, user_id, channel)
SELECT n.id, 3, 'telegram' FROM n
ON CONFLICT (notification_id, user_id) DO NOTHING;