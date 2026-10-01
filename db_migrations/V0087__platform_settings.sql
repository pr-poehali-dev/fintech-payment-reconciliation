CREATE TABLE t_p83864310_fintech_payment_reco.platform_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    managing_company_id INTEGER NULL,
    cron_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    cron_token VARCHAR(64) NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
    cron_last_tick_at TIMESTAMP NULL,
    cron_last_result JSONB NULL,
    updated_by INTEGER NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
INSERT INTO t_p83864310_fintech_payment_reco.platform_settings (id, managing_company_id) VALUES (1, 2);