CREATE TABLE IF NOT EXISTS t_p83864310_fintech_payment_reco.ecomkassa_payment_types (
    id INTEGER PRIMARY KEY,
    code INTEGER,
    description TEXT NOT NULL,
    provider_code TEXT UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE t_p83864310_fintech_payment_reco.ecomkassa_payment_types IS 'Справочник видов оплат Екомкассы (GET /fiscalorder/v4/:storeId/paymentTypes), общий для всех клиентов';
COMMENT ON COLUMN t_p83864310_fintech_payment_reco.ecomkassa_payment_types.provider_code IS 'Код платёжной системы из invoice_payload.provider шлюза (TOCHKA_SBP и т.п.)';

INSERT INTO t_p83864310_fintech_payment_reco.ecomkassa_payment_types (id, code, description, provider_code) VALUES
    (102, 1, 'Платёж через счёт "Тинькофф Эквайринг"', 'TINKOFF_BANK'),
    (108, 1, 'Платёж через СБП банка "Точка"', 'TOCHKA_SBP'),
    (111, 1, 'Платёж через счёт "Тинькофф СБП"', NULL),
    (112, 1, 'Платёж через счёт "Тинькофф Рассрочка"', NULL),
    (113, 1, 'Платёж через эквайринг банка "Точка"', 'TOCHKA_BANK'),
    (115, 1, 'Платёж через счёт "Плайт"', NULL),
    (116, 1, 'Платёж через счёт "Долями"', NULL)
ON CONFLICT (id) DO NOTHING;