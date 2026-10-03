UPDATE t_p83864310_fintech_payment_reco.automation_jobs
SET status = 'error', step = 'action', last_error = 'Чек коррекции #115106794 упал в кассе (FAILED) - повтор на магазине 990',
    updated_at = NOW()
WHERE id = 9 AND company_id = 4;
UPDATE t_p83864310_fintech_payment_reco.automation_documents
SET external_id = external_id || '-old115106794', updated_at = NOW()
WHERE job_id = 9 AND external_id = '7724923302-900000001-correction';