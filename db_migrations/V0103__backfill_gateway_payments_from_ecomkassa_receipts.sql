INSERT INTO t_p83864310_fintech_payment_reco.webhook_payments (
    integration_id, company_id, payment_id, terminal_key, amount, order_id, status, payment_status, error_code,
    customer_email, customer_phone, pan, card_type, exp_date, raw_data, receipt_id, payment_provider, created_at
)
SELECT gw.id, r.company_id, r.order_id, NULL, r.total_sum, r.order_id, 'CONFIRMED', NULL, NULL,
       NULL, NULL, NULL, NULL, NULL, r.raw_data, r.id, r.payment_provider,
       COALESCE(r.doc_datetime - interval '3 hours', r.created_at)
FROM t_p83864310_fintech_payment_reco.ecomkassa_receipts r
JOIN LATERAL (
    SELECT ui.id FROM t_p83864310_fintech_payment_reco.user_integrations ui
    JOIN t_p83864310_fintech_payment_reco.integration_providers p ON p.id = ui.provider_id
    WHERE ui.company_id = r.company_id AND p.slug = 'ecomkassa_gateway' AND ui.status = 'active'
    ORDER BY ui.id LIMIT 1
) gw ON true
WHERE r.payment_provider IS NOT NULL AND r.removed_at IS NULL AND r.status = 'done'
  AND r.raw_data ? 'invoice_payload'
  AND NOT EXISTS (SELECT 1 FROM t_p83864310_fintech_payment_reco.webhook_payments wp
                  WHERE wp.company_id = r.company_id AND wp.payment_id = r.order_id)
ON CONFLICT (integration_id, payment_id, status) DO NOTHING;