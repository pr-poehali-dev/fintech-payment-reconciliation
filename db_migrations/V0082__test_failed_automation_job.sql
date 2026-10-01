INSERT INTO t_p83864310_fintech_payment_reco.automation_jobs
    (company_id, scenario_id, source_type, source_id, status, attempts, next_attempt_at, payload)
VALUES (4, 3, 'payment', '999999999', 'error', 3, NOW(), '{"test": "notification check"}'::jsonb)
ON CONFLICT (scenario_id, source_type, source_id) DO NOTHING;