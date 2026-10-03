UPDATE t_p83864310_fintech_payment_reco.user_integrations ui
SET last_synced_at = r.last_run
FROM (
    SELECT company_id, MAX(finished_at) AS last_run
    FROM t_p83864310_fintech_payment_reco.cron_source_runs
    WHERE source IN ('ecomkassa', 'ecomkassa_receipts') AND error IS NULL
    GROUP BY company_id
) r, t_p83864310_fintech_payment_reco.integration_providers p
WHERE p.id = ui.provider_id AND p.slug = 'ecomkassa' AND ui.company_id = r.company_id
  AND ui.last_synced_at IS NULL;