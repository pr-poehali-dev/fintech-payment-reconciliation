-- Добавляем категорию CRM и провайдеров CRM/Банки
INSERT INTO integration_categories (name, slug, icon, sort_order) VALUES
('CRM', 'crm', 'Users', 5);

INSERT INTO integration_providers (category_id, name, slug, logo_url, description, webhook_enabled, status)
SELECT id, 'Битрикс24', 'bitrix24', 'https://cdn.poehali.dev/projects/logos/bitrix24.svg', 'Обмен лидами и сделками с Битрикс24', true, 'active' FROM integration_categories WHERE slug = 'crm'
UNION ALL
SELECT id, 'AmoCRM', 'amocrm', 'https://cdn.poehali.dev/projects/logos/amocrm.svg', 'Сделки и контакты, обмен статусами воронки', true, 'active' FROM integration_categories WHERE slug = 'crm';

INSERT INTO integration_providers (category_id, name, slug, logo_url, description, webhook_enabled, status)
SELECT id, 'Т-Банк (Расчётный счёт)', 'tbank_account', 'https://cdn.poehali.dev/projects/logos/tbank.svg', 'Выписка по счёту, остатки и движения средств', true, 'active' FROM integration_categories WHERE slug = 'banks'
UNION ALL
SELECT id, 'Точка (Расчётный счёт)', 'tochka_account', 'https://cdn.poehali.dev/projects/logos/tochka.svg', 'Выписка по счёту, остатки и движения средств', true, 'active' FROM integration_categories WHERE slug = 'banks'
UNION ALL
SELECT id, 'Модульбанк (Расчётный счёт)', 'modulbank_account', 'https://cdn.poehali.dev/projects/logos/modulbank.svg', 'Выписка по счёту, остатки и движения средств', true, 'active' FROM integration_categories WHERE slug = 'banks';