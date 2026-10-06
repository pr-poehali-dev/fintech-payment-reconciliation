CREATE TABLE t_p83864310_fintech_payment_reco.landing_cases (
    id SERIAL PRIMARY KEY,
    task TEXT NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    logo_url TEXT,
    niche VARCHAR(200) NOT NULL,
    solution TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);