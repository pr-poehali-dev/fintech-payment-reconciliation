-- Таблица категорий интеграций
CREATE TABLE integration_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  icon VARCHAR(50),
  sort_order INT DEFAULT 0
);

-- Таблица типов провайдеров (шаблоны интеграций)
CREATE TABLE integration_providers (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES integration_categories(id),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  logo_url VARCHAR(255),
  description TEXT,
  webhook_enabled BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'active'
);

-- Таблица подключенных интеграций пользователя
CREATE TABLE user_integrations (
  id SERIAL PRIMARY KEY,
  owner_id INT NOT NULL,
  provider_id INT REFERENCES integration_providers(id),
  integration_name VARCHAR(100),
  webhook_token VARCHAR(64) UNIQUE NOT NULL,
  config JSONB,
  status VARCHAR(20) DEFAULT 'active',
  webhook_settings JSONB,
  last_webhook_at TIMESTAMP,
  webhook_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблица платежей из вебхуков
CREATE TABLE webhook_payments (
  id SERIAL PRIMARY KEY,
  integration_id INT REFERENCES user_integrations(id),
  owner_id INT NOT NULL,
  payment_id VARCHAR(100) NOT NULL,
  terminal_key VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  order_id VARCHAR(100),
  status VARCHAR(50) NOT NULL,
  payment_status VARCHAR(50),
  error_code VARCHAR(10),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  pan VARCHAR(50),
  card_type VARCHAR(20),
  exp_date VARCHAR(10),
  raw_data JSONB NOT NULL,
  receipt_id INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhook_payments_owner ON webhook_payments(owner_id, created_at DESC);
CREATE INDEX idx_webhook_payments_integration ON webhook_payments(integration_id, created_at DESC);
CREATE INDEX idx_webhook_payments_payment_id ON webhook_payments(payment_id);

-- Заполняем базовые данные
INSERT INTO integration_categories (name, slug, icon, sort_order) VALUES
('Платежи', 'payments', 'CreditCard', 1),
('Кассы', 'cash_registers', 'ShoppingCart', 2),
('ОФД', 'ofd', 'Receipt', 3),
('Банки', 'banks', 'Building', 4);

INSERT INTO integration_providers (category_id, name, slug, logo_url, description, webhook_enabled) VALUES
(1, 'Т-Банк (Эквайринг)', 'tbank', 'https://cdn.poehali.dev/projects/logos/tbank.svg', 'Прием платежей через эквайринг Т-Банка', true),
(1, 'ЮKassa', 'yookassa', 'https://cdn.poehali.dev/projects/logos/yookassa.svg', 'Прием платежей через ЮKassa', true),
(1, 'Точка Банк', 'tochka', 'https://cdn.poehali.dev/projects/logos/tochka.svg', 'Прием платежей через Точка Банк', true);