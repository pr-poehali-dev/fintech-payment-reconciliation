ALTER TABLE t_p83864310_fintech_payment_reco.bank_statement_transactions
    ADD COLUMN IF NOT EXISTS linked_payment_id integer NULL,
    ADD COLUMN IF NOT EXISTS parent_transaction_id integer NULL,
    ADD COLUMN IF NOT EXISTS settlement_date date NULL;