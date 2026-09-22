UPDATE t_p83864310_fintech_payment_reco.bank_statement_transactions
SET external_transaction_id = external_transaction_id || '_cleared_for_retest'
WHERE integration_id = 11;