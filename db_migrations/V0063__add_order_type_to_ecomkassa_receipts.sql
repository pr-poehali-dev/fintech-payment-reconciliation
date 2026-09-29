-- Тип документа Екомкассы (VCHR/INVC/CORD), из которого получен чек - нужен,
-- чтобы отличать обычный чек/счёт от курьерского заказа (CORD), который в
-- разделе "Транзакции" показывается отдельной сущностью "Заказ".
-- NULL - для чеков, пришедших "живым" вебхуком до этой миграции (шлюз не
-- передаёт orderType), таких считаем обычным чеком кассы.
ALTER TABLE t_p83864310_fintech_payment_reco.ecomkassa_receipts
ADD COLUMN order_type VARCHAR(10) NULL;

COMMENT ON COLUMN t_p83864310_fintech_payment_reco.ecomkassa_receipts.order_type IS
'Тип документа Екомкассы: VCHR - чек, INVC - счёт, CORD - курьерский заказ (NULL - пришло вебхуком до введения колонки, считается чеком)';
