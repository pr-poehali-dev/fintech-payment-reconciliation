INSERT INTO t_p83864310_fintech_payment_reco.company_users (company_id, user_id, role_id, status, joined_at)
SELECT c.id, u.id, r.id, 'active', now()
FROM t_p83864310_fintech_payment_reco.companies c,
     t_p83864310_fintech_payment_reco.app_users u,
     t_p83864310_fintech_payment_reco.roles r
WHERE c.name = 'Демо-компания' AND u.phone = '+79991234567' AND r.slug = 'owner';
