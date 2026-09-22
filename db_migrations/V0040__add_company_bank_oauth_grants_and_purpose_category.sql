-- T-Business ID OAuth-согласие выдаётся на уровне компании (не отдельной интеграции) -
-- одно согласие открывает доступ сразу ко всем счетам компании в Т-Банке.
-- Отдельная таблица от bank_oauth_tokens (та осталась per-integration для прочих банков).
CREATE TABLE IF NOT EXISTS t_p83864310_fintech_payment_reco.company_bank_oauth_grants (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.companies(id),
    provider_slug VARCHAR(50) NOT NULL,
    is_sandbox BOOLEAN NOT NULL DEFAULT false,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    scope VARCHAR(255),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_grant_per_company_provider UNIQUE (company_id, provider_slug)
);

CREATE INDEX IF NOT EXISTS idx_company_bank_oauth_grants_company ON t_p83864310_fintech_payment_reco.company_bank_oauth_grants(company_id);

-- Классификация назначения платежа для транзакций расчётного счёта:
-- учитываем только эквайринг (онлайн/торговый) и прямые оплаты от физлиц,
-- остальное (налоги, зарплата, переводы между своими счетами и т.д.) отсеиваем.
ALTER TABLE t_p83864310_fintech_payment_reco.bank_statement_transactions
    ADD COLUMN IF NOT EXISTS purpose_category VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_bank_tx_purpose_category ON t_p83864310_fintech_payment_reco.bank_statement_transactions(purpose_category);

-- Настройки интеграции расчётного счёта: с какой периодичностью синхронизировать
-- (пока фактически работает только ручная кнопка "Синхронизировать сейчас",
-- поле сохраняет желаемую настройку на будущее для внешнего планировщика)
-- и по каким назначениям платежа фильтровать входящие операции.
ALTER TABLE t_p83864310_fintech_payment_reco.user_integrations
    ADD COLUMN IF NOT EXISTS sync_interval_hours INTEGER;

ALTER TABLE t_p83864310_fintech_payment_reco.user_integrations
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;