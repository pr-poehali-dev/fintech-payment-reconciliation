CREATE TABLE IF NOT EXISTS t_p83864310_fintech_payment_reco.cron_source_runs (
    source VARCHAR(40) NOT NULL,
    company_id INTEGER NOT NULL,
    tick VARCHAR(40) NOT NULL,
    item_key VARCHAR(40) NOT NULL DEFAULT '',
    loaded INTEGER NOT NULL DEFAULT 0,
    error TEXT NULL,
    finished_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (source, company_id, item_key)
);