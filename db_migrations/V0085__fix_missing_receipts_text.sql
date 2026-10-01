UPDATE t_p83864310_fintech_payment_reco.notifications
SET message = replace(message, 'с фильтром «Без пары».', 'с фильтром «Только без связи».')
WHERE kind = 'missing_receipts';