CREATE TABLE t_p83864310_fintech_payment_reco.invite_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(64) NOT NULL UNIQUE,
    company_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.companies(id),
    role_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.roles(id),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    full_name VARCHAR(150),
    channel VARCHAR(20) NOT NULL DEFAULT 'telegram',
    invited_by INTEGER REFERENCES t_p83864310_fintech_payment_reco.app_users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_invite_tokens_company ON t_p83864310_fintech_payment_reco.invite_tokens(company_id, status);
CREATE INDEX idx_invite_tokens_phone ON t_p83864310_fintech_payment_reco.invite_tokens(phone);
