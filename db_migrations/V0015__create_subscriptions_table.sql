CREATE TABLE t_p83864310_fintech_payment_reco.subscriptions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.companies(id),
    tariff_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.tariffs(id),
    status VARCHAR(20) NOT NULL DEFAULT 'trial',
    trial_ends_at TIMESTAMP,
    current_period_start TIMESTAMP NOT NULL DEFAULT now(),
    current_period_end TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
