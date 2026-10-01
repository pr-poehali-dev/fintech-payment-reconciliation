CREATE TABLE t_p83864310_fintech_payment_reco.notification_checks (
    company_id INTEGER NOT NULL,
    kind VARCHAR(50) NOT NULL,
    period VARCHAR(20) NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0,
    checked_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, kind, period)
);