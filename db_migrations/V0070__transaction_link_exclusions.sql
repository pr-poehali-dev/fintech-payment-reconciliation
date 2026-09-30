CREATE TABLE IF NOT EXISTS t_p83864310_fintech_payment_reco.transaction_link_exclusions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.companies(id),
    tx_type VARCHAR(20) NOT NULL,
    tx_source VARCHAR(50) NOT NULL,
    tx_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, tx_type, tx_source, tx_id)
);