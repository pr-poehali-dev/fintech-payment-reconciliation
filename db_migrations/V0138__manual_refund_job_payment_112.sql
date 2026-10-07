INSERT INTO t_p83864310_fintech_payment_reco.automation_jobs (company_id, scenario_id, source_type, source_id, payload)
SELECT 5, 23, 'payment', '112', '{"webhook_payment_id": 112}'::jsonb
WHERE EXISTS (SELECT 1 FROM t_p83864310_fintech_payment_reco.webhook_payments WHERE id = 112 AND status = 'CANCELED')
ON CONFLICT (scenario_id, source_type, source_id) DO NOTHING;

INSERT INTO t_p83864310_fintech_payment_reco.automation_job_log (job_id, level, message)
SELECT j.id, 'info', 'Задание создано вручную по уведомлению об отмене платежа (статус отменён)'
FROM t_p83864310_fintech_payment_reco.automation_jobs j
WHERE j.scenario_id = 23 AND j.source_type = 'payment' AND j.source_id = '112'
  AND NOT EXISTS (SELECT 1 FROM t_p83864310_fintech_payment_reco.automation_job_log l WHERE l.job_id = j.id);