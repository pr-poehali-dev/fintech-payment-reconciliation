-- Деактивация провайдеров, которые пока не готовы к использованию
UPDATE t_p83864310_fintech_payment_reco.integration_providers 
SET status = 'inactive' 
WHERE slug IN ('yookassa', 'tochka');