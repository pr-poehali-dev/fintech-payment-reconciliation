UPDATE t_p83864310_fintech_payment_reco.roles
SET modules = modules - 'dashboard', updated_at = NOW()
WHERE modules ? 'dashboard';