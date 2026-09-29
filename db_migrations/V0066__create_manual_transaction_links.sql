-- Ручная связка транзакций пользователем (кнопка "Связать" в реестре
-- "Транзакции"). Одна строка = одна транзакция внутри группы; все строки с
-- одинаковым link_group_id считаются связанными - та же модель, что
-- использует фронтенд для автоматических связей (union-find по linked_id),
-- только источник связи здесь - явное решение пользователя, а не совпадение
-- фискальных реквизитов/receipt_id.
-- tx_type/tx_source/tx_id - это ровно (type, source, id) транзакции, как их
-- возвращает transactions-list, поэтому запись работает для любого типа
-- (payment/receipt_ofd/receipt_kassa/receipt_order/money) без доп. FK на
-- разнородные исходные таблицы.
CREATE TABLE t_p83864310_fintech_payment_reco.manual_transaction_links (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.companies(id),
    link_group_id UUID NOT NULL,
    tx_type VARCHAR(20) NOT NULL,
    tx_source VARCHAR(50) NOT NULL,
    tx_id INTEGER NOT NULL,
    created_by INTEGER NULL REFERENCES t_p83864310_fintech_payment_reco.app_users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_manual_link_member UNIQUE (company_id, tx_type, tx_source, tx_id)
);

CREATE INDEX idx_manual_links_company ON t_p83864310_fintech_payment_reco.manual_transaction_links(company_id);
CREATE INDEX idx_manual_links_group ON t_p83864310_fintech_payment_reco.manual_transaction_links(link_group_id);
