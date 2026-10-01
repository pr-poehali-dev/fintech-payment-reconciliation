CREATE TABLE t_p83864310_fintech_payment_reco.notification_preferences (
    company_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    channel VARCHAR(20) NULL,
    kinds JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, user_id)
);

CREATE TABLE t_p83864310_fintech_payment_reco.notification_deliveries (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (notification_id, user_id)
);