-- Дискриминатор платёжной системы внутри шлюза Екомкассы (invoice_payload.provider
-- из ответа report(), например "ЮKassa", "СБП" и т.п. - у одной кассы Екомкассы
-- может быть подключено более 10 видов оплат). Нужен для фильтрации событий
-- и детализации сверки по конкретному способу оплаты.
ALTER TABLE t_p83864310_fintech_payment_reco.webhook_payments
    ADD COLUMN IF NOT EXISTS payment_provider character varying(100) NULL;

ALTER TABLE t_p83864310_fintech_payment_reco.ecomkassa_receipts
    ADD COLUMN IF NOT EXISTS payment_provider character varying(100) NULL;
