UPDATE t_p83864310_fintech_payment_reco.user_integrations
SET status = 'inactive', integration_name = integration_name || ' (тест, можно удалить)'
WHERE id = 18;
