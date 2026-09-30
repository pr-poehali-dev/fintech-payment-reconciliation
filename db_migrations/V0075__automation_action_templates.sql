CREATE TABLE t_p83864310_fintech_payment_reco.automation_action_templates (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    action_type VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    operation VARCHAR(30) NOT NULL DEFAULT 'sell',
    paid BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO t_p83864310_fintech_payment_reco.automation_action_templates (code, action_type, name, description, operation, paid, sort_order) VALUES
('regular', 'create_receipt', 'Обычный чек', 'Чек прихода по оплате', 'sell', TRUE, 10),
('correction', 'create_receipt', 'Чек коррекции', 'Исправление ошибки в ранее пробитом чеке', 'sell_correction', TRUE, 20),
('closing', 'create_receipt', 'Закрывающий чек', 'Чек при передаче товара после предоплаты', 'sell', TRUE, 30),
('paid_order', 'create_order', 'Оплаченный заказ', 'Заказ в кассе с оплатой на сумму корзины', 'sell', TRUE, 40),
('unpaid_order', 'create_order', 'Неоплаченный заказ', 'Заказ в кассе без оплаты (оплата при получении)', 'sell', FALSE, 50);