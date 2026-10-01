CREATE TABLE t_p83864310_fintech_payment_reco.notifications (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    kind VARCHAR(50) NOT NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link_module VARCHAR(50) NULL,
    entity_type VARCHAR(50) NULL,
    entity_id VARCHAR(64) NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_company ON t_p83864310_fintech_payment_reco.notifications (company_id, created_at DESC);

CREATE TABLE t_p83864310_fintech_payment_reco.notification_reads (
    notification_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    read_at TIMESTAMP NOT NULL DEFAULT NOW(),
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (notification_id, user_id)
);