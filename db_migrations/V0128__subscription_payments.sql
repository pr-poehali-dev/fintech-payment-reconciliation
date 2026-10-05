CREATE TABLE t_p83864310_fintech_payment_reco.subscription_payments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.companies(id),
    user_id INTEGER NOT NULL,
    tariff_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.tariffs(id),
    period VARCHAR(10) NOT NULL,
    days INTEGER NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'paid',
    period_end TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_subscription_payments_company ON t_p83864310_fintech_payment_reco.subscription_payments(company_id);