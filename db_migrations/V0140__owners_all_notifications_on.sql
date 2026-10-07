INSERT INTO t_p83864310_fintech_payment_reco.notification_preferences (company_id, user_id, channel, kinds)
SELECT cu.company_id, cu.user_id,
       COALESCE((SELECT p2.channel FROM t_p83864310_fintech_payment_reco.notification_preferences p2
                 WHERE p2.user_id = cu.user_id AND p2.channel IS NOT NULL ORDER BY p2.updated_at DESC LIMIT 1), 'email'),
       '["automation_failed", "receipt_failed", "missing_receipts"]'::jsonb
FROM t_p83864310_fintech_payment_reco.company_users cu
JOIN t_p83864310_fintech_payment_reco.roles r ON r.id = cu.role_id AND r.slug = 'owner'
WHERE cu.status = 'active'
ON CONFLICT (company_id, user_id) DO UPDATE SET
    kinds = '["automation_failed", "receipt_failed", "missing_receipts"]'::jsonb,
    channel = COALESCE(t_p83864310_fintech_payment_reco.notification_preferences.channel, EXCLUDED.channel),
    updated_at = NOW();