-- Временная правка для сквозного теста автообновления токена Екомкассы:
-- сохраняем пароль кассы sales@ecomkassa.ru в config интеграции id=14,
-- чтобы ensure_valid_token мог получить новый токен по логину/паролю.
UPDATE t_p83864310_fintech_payment_reco.user_integrations
SET config = config || jsonb_build_object('password', 'ecomkassa1')
WHERE id = 14;
