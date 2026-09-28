-- Добавляем тестовую компанию (ликвидированное ООО, не ИП) для тестирования
-- интеграций без риска для реальных данных. Владелец - пользователь id=3
-- (Носов Александр Сергеевич), уже владеющий компаниями 2 и 3.
INSERT INTO t_p83864310_fintech_payment_reco.companies
    (name, inn, kpp, ogrn, full_name, legal_address, status, created_by)
VALUES (
    'РАССВЕТ (тест)',
    '7724923302',
    '610101001',
    '1147746619240',
    'ООО "РАССВЕТ"',
    'Ростовская обл, Азовский р-н, село Кагальник, ул Ростовская, д 6',
    'active',
    3
);

INSERT INTO t_p83864310_fintech_payment_reco.company_users
    (company_id, user_id, role_id, status, joined_at)
SELECT c.id, 3, r.id, 'active', now()
FROM t_p83864310_fintech_payment_reco.companies c
JOIN t_p83864310_fintech_payment_reco.roles r ON r.slug = 'owner'
WHERE c.inn = '7724923302' AND c.name = 'РАССВЕТ (тест)';

INSERT INTO t_p83864310_fintech_payment_reco.subscriptions
    (company_id, tariff_id, status, trial_ends_at, current_period_start, current_period_end)
SELECT c.id, t.id, 'trial', now() + interval '365 days', now(), now() + interval '365 days'
FROM t_p83864310_fintech_payment_reco.companies c
JOIN t_p83864310_fintech_payment_reco.tariffs t ON t.slug = 'trial'
WHERE c.inn = '7724923302' AND c.name = 'РАССВЕТ (тест)';
