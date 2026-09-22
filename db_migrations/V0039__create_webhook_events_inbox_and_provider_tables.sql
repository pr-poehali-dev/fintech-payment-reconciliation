-- Inbox-таблица для сырых входящих событий от всех провайдеров (вебхуки CRM, банков и т.д.)
-- Роутер webhook-receive пишет сюда всё как есть, обработчики каждого провайдера читают отсюда.
CREATE TABLE IF NOT EXISTS t_p83864310_fintech_payment_reco.webhook_events (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.user_integrations(id),
    company_id INTEGER NOT NULL,
    provider_slug VARCHAR(50) NOT NULL,
    event_type VARCHAR(100),
    raw_payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_status ON t_p83864310_fintech_payment_reco.webhook_events(provider_slug, status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_integration ON t_p83864310_fintech_payment_reco.webhook_events(integration_id, created_at DESC);

-- Сделки CRM (Битрикс24, AmoCRM), получаемые через вебхук + доход в API за деталями
CREATE TABLE IF NOT EXISTS t_p83864310_fintech_payment_reco.crm_deals (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.user_integrations(id),
    company_id INTEGER NOT NULL,
    provider_slug VARCHAR(50) NOT NULL,
    external_deal_id VARCHAR(100) NOT NULL,
    title VARCHAR(255),
    stage VARCHAR(100),
    amount DECIMAL(15, 2),
    currency VARCHAR(10),
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_deal_per_integration UNIQUE (integration_id, external_deal_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_deals_integration ON t_p83864310_fintech_payment_reco.crm_deals(integration_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_company ON t_p83864310_fintech_payment_reco.crm_deals(company_id);

-- Транзакции по банковской выписке, получаемые пуллингом по кнопке "Синхронизировать"
CREATE TABLE IF NOT EXISTS t_p83864310_fintech_payment_reco.bank_statement_transactions (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.user_integrations(id),
    company_id INTEGER NOT NULL,
    provider_slug VARCHAR(50) NOT NULL,
    external_transaction_id VARCHAR(255) NOT NULL,
    operation_date TIMESTAMP,
    amount DECIMAL(15, 2),
    direction VARCHAR(10),
    counterparty_name VARCHAR(255),
    counterparty_inn VARCHAR(20),
    purpose TEXT,
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_transaction_per_integration UNIQUE (integration_id, external_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_tx_integration ON t_p83864310_fintech_payment_reco.bank_statement_transactions(integration_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_company ON t_p83864310_fintech_payment_reco.bank_statement_transactions(company_id);