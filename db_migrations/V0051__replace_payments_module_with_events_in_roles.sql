UPDATE t_p83864310_fintech_payment_reco.roles
SET modules = (
    SELECT jsonb_agg(CASE WHEN elem = '"payments"' THEN '"events"'::jsonb ELSE elem END)
    FROM jsonb_array_elements(modules) AS elem
)
WHERE modules::text LIKE '%payments%';