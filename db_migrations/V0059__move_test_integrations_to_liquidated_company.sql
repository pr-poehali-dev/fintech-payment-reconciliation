-- Переносим 4 интеграции (Екомкасса-касса id=14, Екомкасса-шлюз "Тест СБЕРА" id=17,
-- ОФД "Демо касса ОФД" id=8, Т-Банк "тест песочницы" id=11) из компании 2
-- в тестовую компанию 4 (РАССВЕТ, ИНН 7724923302), вместе со связанными
-- историческими данными (ofd_receipts, bank_statement_transactions),
-- у которых есть собственная колонка company_id.
UPDATE t_p83864310_fintech_payment_reco.user_integrations
SET company_id = 4, updated_at = NOW()
WHERE id IN (14, 17, 8, 11);

UPDATE t_p83864310_fintech_payment_reco.ofd_receipts
SET company_id = 4
WHERE integration_id = 8;

UPDATE t_p83864310_fintech_payment_reco.bank_statement_transactions
SET company_id = 4
WHERE integration_id = 11;
