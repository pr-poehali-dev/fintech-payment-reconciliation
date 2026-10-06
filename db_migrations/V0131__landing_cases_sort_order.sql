ALTER TABLE t_p83864310_fintech_payment_reco.landing_cases ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
UPDATE t_p83864310_fintech_payment_reco.landing_cases c SET sort_order = r.rn
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC, id DESC) AS rn FROM t_p83864310_fintech_payment_reco.landing_cases) r
WHERE r.id = c.id;