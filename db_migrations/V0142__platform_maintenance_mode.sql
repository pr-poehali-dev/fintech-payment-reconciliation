ALTER TABLE t_p83864310_fintech_payment_reco.platform_settings
    ADD COLUMN IF NOT EXISTS maintenance_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS maintenance_message text NULL,
    ADD COLUMN IF NOT EXISTS maintenance_until timestamp with time zone NULL;