-- Чеки, загруженные через API Екомкассы (fiscalorder v4/v5).
-- Отдельная таблица от ofd_receipts, т.к. модель данных другая (legacyNo/orderId,
-- статус заказа), но с совместимыми полями, чтобы позже объединить в общий список чеков.
CREATE TABLE IF NOT EXISTS t_p83864310_fintech_payment_reco.ecomkassa_receipts (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.user_integrations(id),
    company_id INTEGER NOT NULL,
    order_id VARCHAR(255),
    legacy_no VARCHAR(255),
    status VARCHAR(50),
    total_sum DECIMAL(15, 2),
    doc_number VARCHAR(50),
    doc_datetime TIMESTAMP,
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_ecomkassa_order_per_integration UNIQUE (integration_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_ecomkassa_receipts_integration ON t_p83864310_fintech_payment_reco.ecomkassa_receipts(integration_id);
CREATE INDEX IF NOT EXISTS idx_ecomkassa_receipts_company ON t_p83864310_fintech_payment_reco.ecomkassa_receipts(company_id);
CREATE INDEX IF NOT EXISTS idx_ecomkassa_receipts_legacy_no ON t_p83864310_fintech_payment_reco.ecomkassa_receipts(legacy_no);