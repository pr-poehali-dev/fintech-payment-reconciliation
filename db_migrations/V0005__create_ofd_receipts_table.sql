-- Таблица для хранения чеков из OFD.RU
CREATE TABLE IF NOT EXISTS t_p83864310_fintech_payment_reco.ofd_receipts (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    receipt_id VARCHAR(255) NOT NULL,
    operation_type VARCHAR(50),
    total_sum DECIMAL(15, 2),
    cash_sum DECIMAL(15, 2),
    ecash_sum DECIMAL(15, 2),
    doc_number VARCHAR(50),
    doc_datetime TIMESTAMP,
    fn_number VARCHAR(50),
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_receipt_per_integration UNIQUE (integration_id, receipt_id)
);

CREATE INDEX IF NOT EXISTS idx_ofd_receipts_integration ON t_p83864310_fintech_payment_reco.ofd_receipts(integration_id);
CREATE INDEX IF NOT EXISTS idx_ofd_receipts_owner ON t_p83864310_fintech_payment_reco.ofd_receipts(owner_id);
CREATE INDEX IF NOT EXISTS idx_ofd_receipts_datetime ON t_p83864310_fintech_payment_reco.ofd_receipts(doc_datetime);
