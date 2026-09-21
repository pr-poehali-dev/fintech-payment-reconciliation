CREATE TABLE t_p83864310_fintech_payment_reco.company_users (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.companies(id),
    user_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.app_users(id),
    role_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.roles(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    invited_by INTEGER REFERENCES t_p83864310_fintech_payment_reco.app_users(id),
    invited_at TIMESTAMP,
    joined_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(company_id, user_id)
);
