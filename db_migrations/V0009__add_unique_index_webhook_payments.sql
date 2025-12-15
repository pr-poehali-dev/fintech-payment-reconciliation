-- Добавить уникальный индекс для предотвращения дублей вебхуков
-- Один платеж может иметь несколько статусов, но комбинация (integration_id, payment_id, status) уникальна
CREATE UNIQUE INDEX idx_webhook_payments_unique_status 
ON t_p83864310_fintech_payment_reco.webhook_payments (integration_id, payment_id, status);