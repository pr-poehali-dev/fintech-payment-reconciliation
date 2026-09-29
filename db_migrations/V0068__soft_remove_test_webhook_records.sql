UPDATE t_p83864310_fintech_payment_reco.webhook_payments SET removed_at = NOW()
WHERE payment_id IN ('test-invc-with-payment-002', 'test-cord-with-payment-004');

UPDATE t_p83864310_fintech_payment_reco.ecomkassa_receipts SET removed_at = NOW()
WHERE order_id IN ('test-vchr-no-payment-001', 'test-invc-with-payment-002', 'test-cord-no-payment-003', 'test-cord-with-payment-004');
