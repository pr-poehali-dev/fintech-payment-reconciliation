UPDATE t_p83864310_fintech_payment_reco.ecomkassa_receipts
SET doc_datetime = ((raw_data->'payload'->>'receipt_datetime')::timestamptz AT TIME ZONE 'UTC')
WHERE source = 'tbank'
  AND raw_data->'payload'->>'receipt_datetime' ~ '([+-][0-9]{2}:[0-9]{2}|Z)$';