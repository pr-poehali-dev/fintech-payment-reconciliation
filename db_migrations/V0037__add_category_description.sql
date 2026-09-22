ALTER TABLE integration_categories ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE integration_categories SET description = 'Приём платежей через эквайринг и электронные кошельки' WHERE slug = 'payments';
UPDATE integration_categories SET description = 'Данные с онлайн-касс и фискальных накопителей' WHERE slug = 'cash_registers';
UPDATE integration_categories SET description = 'Загрузка чеков из операторов фискальных данных' WHERE slug = 'ofd';
UPDATE integration_categories SET description = 'Выписки и движения по расчётным счетам' WHERE slug = 'banks';
UPDATE integration_categories SET description = 'Клиенты и сделки синхронизируются с вашей CRM' WHERE slug = 'crm';