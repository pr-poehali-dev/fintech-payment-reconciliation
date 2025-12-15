-- Добавление поля для переадресации вебхуков на внешний URL
ALTER TABLE user_integrations 
ADD COLUMN forward_url VARCHAR(500);