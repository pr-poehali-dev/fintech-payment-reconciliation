INSERT INTO t_p83864310_fintech_payment_reco.subscriptions (company_id, tariff_id, status, trial_ends_at, current_period_start, current_period_end)
SELECT c.id, t.id, 'trial', now() + interval '14 days', now(), now() + interval '14 days'
FROM t_p83864310_fintech_payment_reco.companies c, t_p83864310_fintech_payment_reco.tariffs t
WHERE c.name = 'Демо-компания' AND t.slug = 'trial';
