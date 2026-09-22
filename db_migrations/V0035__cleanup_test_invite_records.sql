UPDATE t_p83864310_fintech_payment_reco.company_users SET status = 'removed' WHERE user_id = 6 AND company_id = 1;
UPDATE t_p83864310_fintech_payment_reco.invite_tokens SET status = 'cancelled' WHERE phone IN ('79991112233', '79992223344', '79993334455') AND status = 'pending';
