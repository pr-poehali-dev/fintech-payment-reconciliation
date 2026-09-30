CREATE TABLE t_p83864310_fintech_payment_reco.payment_carts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.companies(id),
    integration_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.user_integrations(id),
    payment_id VARCHAR(100) NOT NULL,
    order_id VARCHAR(255) NULL,
    source VARCHAR(50) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    receipt JSONB NOT NULL DEFAULT '{}'::jsonb,
    items_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payment_carts_integration_payment UNIQUE (integration_id, payment_id)
);

CREATE INDEX idx_payment_carts_company ON t_p83864310_fintech_payment_reco.payment_carts(company_id, created_at DESC);