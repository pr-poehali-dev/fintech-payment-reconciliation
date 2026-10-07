UPDATE t_p83864310_fintech_payment_reco.user_integrations ui
SET webhook_settings = COALESCE(ui.webhook_settings, '{}'::jsonb) || '{"notify_on_authorized": true, "notify_on_confirmed": true, "notify_on_rejected": true, "notify_on_refunded": true, "notify_on_canceled": true}'::jsonb,
    updated_at = NOW()
FROM t_p83864310_fintech_payment_reco.integration_providers p
WHERE p.id = ui.provider_id
  AND p.slug IN ('tbank', 'alfabank', 'tochka_acquiring', 'ecomkassa_gateway')
  AND ui.status = 'active'
  AND COALESCE(ui.forward_url, '') = '';