UPDATE t_p83864310_fintech_payment_reco.ofd_receipts o
SET doc_datetime = ((o.raw_data->>'DocDateTime')::timestamp
                    AT TIME ZONE COALESCE(NULLIF(c.timezone, ''), 'Europe/Moscow')) AT TIME ZONE 'UTC'
FROM t_p83864310_fintech_payment_reco.companies c
WHERE c.id = o.company_id
  AND o.raw_data ? 'DocDateTime'
  AND o.doc_datetime = (o.raw_data->>'DocDateTime')::timestamp;