CREATE TABLE IF NOT EXISTS t_p83864310_fintech_payment_reco.auth_codes (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    code_hash VARCHAR(128) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    purpose VARCHAR(20) NOT NULL DEFAULT 'login',
    attempts INTEGER NOT NULL DEFAULT 0,
    used_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_phone_created ON t_p83864310_fintech_payment_reco.auth_codes (phone, created_at DESC);

COMMENT ON TABLE t_p83864310_fintech_payment_reco.auth_codes IS 'Одноразовые коды входа из мессенджеров: хранится только хеш, проверка на сервере';