CREATE TABLE IF NOT EXISTS t_p83864310_fintech_payment_reco.user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    user_agent VARCHAR(300),
    ip VARCHAR(64),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON t_p83864310_fintech_payment_reco.user_sessions (user_id);

CREATE TABLE IF NOT EXISTS t_p83864310_fintech_payment_reco.internal_keys (
    id INTEGER PRIMARY KEY,
    key_value VARCHAR(128) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO t_p83864310_fintech_payment_reco.internal_keys (id, key_value)
VALUES (1, md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text))
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE t_p83864310_fintech_payment_reco.user_sessions IS 'Серверные сессии входа: в браузере только токен, здесь его хеш';
COMMENT ON TABLE t_p83864310_fintech_payment_reco.internal_keys IS 'Служебный ключ для вызовов функций друг другом (планировщик, уведомления)';