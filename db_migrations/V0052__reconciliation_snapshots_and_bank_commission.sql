-- Комиссия эквайринга по банковской операции (заполняется, когда появится
-- реестр платежей от банка по терминалу эквайринга - промежуточный шаг,
-- дающий точную комиссию по каждой транзакции вместо эвристики).
ALTER TABLE t_p83864310_fintech_payment_reco.bank_statement_transactions
    ADD COLUMN IF NOT EXISTS commission_amount numeric(15,2) NULL,
    ADD COLUMN IF NOT EXISTS commission_source varchar(20) NULL;

COMMENT ON COLUMN t_p83864310_fintech_payment_reco.bank_statement_transactions.commission_amount IS
    'Комиссия эквайринга, удержанная банком при выплате. NULL, если неизвестна (нет реестра) - тогда в сверке используется сумма поступления как есть';
COMMENT ON COLUMN t_p83864310_fintech_payment_reco.bank_statement_transactions.commission_source IS
    'Источник значения комиссии: registry (загружен реестр платежей терминала) или estimated (оценка)';

-- Снапшоты расчёта сверки за период - хранят итоговые суммы по трём точкам
-- (платежи/чеки/деньги) и детализацию расчёта (details), чтобы не пересчитывать
-- каждый раз и чтобы в будущем можно было показать разбивку под графиком.
CREATE TABLE IF NOT EXISTS t_p83864310_fintech_payment_reco.reconciliation_snapshots (
    id serial PRIMARY KEY,
    company_id integer NOT NULL REFERENCES t_p83864310_fintech_payment_reco.companies(id),
    period_from date NOT NULL,
    period_to date NOT NULL,
    payments_total numeric(15,2) NOT NULL DEFAULT 0,
    payments_count integer NOT NULL DEFAULT 0,
    receipts_total numeric(15,2) NOT NULL DEFAULT 0,
    receipts_count integer NOT NULL DEFAULT 0,
    bank_raw_total numeric(15,2) NOT NULL DEFAULT 0,
    bank_commission_total numeric(15,2) NOT NULL DEFAULT 0,
    bank_total numeric(15,2) NOT NULL DEFAULT 0,
    bank_count integer NOT NULL DEFAULT 0,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    calculated_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (company_id, period_from, period_to)
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_snapshots_company
    ON t_p83864310_fintech_payment_reco.reconciliation_snapshots(company_id);
