CREATE TABLE t_p83864310_fintech_payment_reco.companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    inn VARCHAR(12),
    kpp VARCHAR(9),
    legal_address TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_by INTEGER REFERENCES t_p83864310_fintech_payment_reco.app_users(id),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
