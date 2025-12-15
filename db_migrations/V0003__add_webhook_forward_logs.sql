-- Таблица для логов переадресации вебхуков
CREATE TABLE t_p83864310_fintech_payment_reco.webhook_forward_logs (
    id SERIAL PRIMARY KEY,
    webhook_payment_id INTEGER REFERENCES t_p83864310_fintech_payment_reco.webhook_payments(id),
    forward_url TEXT NOT NULL,
    status_code INTEGER,
    error_message TEXT,
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индекс для быстрого поиска логов по вебхукам
CREATE INDEX idx_webhook_forward_logs_webhook_id ON t_p83864310_fintech_payment_reco.webhook_forward_logs(webhook_payment_id);

-- Индекс для поиска ошибок
CREATE INDEX idx_webhook_forward_logs_status ON t_p83864310_fintech_payment_reco.webhook_forward_logs(status_code) WHERE status_code >= 400;