UPDATE t_p83864310_fintech_payment_reco.user_integrations
SET status = 'active',
    config = '{"account_number": "40802678901234567890", "purpose_categories": ["acquiring_online", "acquiring_offline", "individual_direct"]}'::jsonb,
    sync_interval_hours = 24
WHERE id = 11;